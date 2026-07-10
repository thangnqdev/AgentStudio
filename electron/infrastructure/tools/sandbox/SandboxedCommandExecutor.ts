import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { ToolResult, PermissionMode } from '../../../domain/entities/agent.js';

// ─── spawnAndCollect (inline — tránh import nội bộ trong thư mục sandbox) ────

const MAX_COMMAND_OUTPUT = 40_000;

function trimOutput(output: string): string {
  if (output.length <= MAX_COMMAND_OUTPUT) return output;
  return `${output.slice(0, MAX_COMMAND_OUTPUT)}\n[output truncated]`;
}

// Allowlist environment variables — tránh rò rỉ secrets sang process do agent điều khiển
const ENV_ALLOWLIST = [
  'PATH', 'HOME', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'TMPDIR', 'TEMP', 'TMP', 'TERM', 'USER', 'LOGNAME', 'SHELL',
];

function buildSafeEnv(): Record<string, string> {
  const safeEnv: Record<string, string> = {};
  for (const key of ENV_ALLOWLIST) {
    const value = process.env[key];
    if (typeof value === 'string') safeEnv[key] = value;
  }
  return safeEnv;
}

/**
 * Spawn một process, thu thập stdout/stderr, giới hạn timeout.
 * Sau SIGTERM timeout vẫn còn sống → gửi thêm SIGKILL sau 5 giây.
 */
export function spawnAndCollect(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<ToolResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: buildSafeEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let settled = false;

    const killFallback = (after: number) =>
      setTimeout(() => {
        if (!settled) child.kill('SIGKILL');
      }, after);

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      killFallback(5_000);
      resolve({ ok: false, output: trimOutput(`${output}\nCommand timed out after ${timeoutMs}ms.`) });
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      output = trimOutput(output + chunk.toString('utf8'));
    });
    child.stderr.on('data', (chunk: Buffer) => {
      output = trimOutput(output + chunk.toString('utf8'));
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok: false, output: error.message });
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        output: trimOutput(`${output}\nExit code: ${code ?? 'unknown'}`),
      });
    });
  });
}

// ─── Platform sandbox implementations (inline — tránh import nội bộ) ──────────

function buildSeatbeltProfile(workspaceRoot: string): string {
  const escapedWorkspace = workspaceRoot.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
  const tmp = process.env.TMPDIR || process.env.TEMP || '/tmp';
  const escapedTmp = tmp.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

  return [
    '(version 1)',
    '(deny default)',
    '(allow process*)',
    '(allow signal (target self))',
    '(allow sysctl-read)',
    '(allow file-read*)',
    `(allow file-write* (subpath "${escapedWorkspace}") (subpath "${escapedTmp}") (subpath "/tmp") (subpath "/private/tmp"))`,
  ].join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Điều phối sandbox theo platform. Implement logic chạy lệnh cho tất cả permission modes.
 */
export async function runSandboxedCommand(
  command: string,
  workspaceRoot: string,
  permissionMode: PermissionMode,
  timeoutMs: number,
): Promise<ToolResult> {
  if (permissionMode === 'danger-full-access') {
    if (process.platform === 'win32') {
      return spawnAndCollect('cmd.exe', ['/c', command], workspaceRoot, timeoutMs);
    }
    return spawnAndCollect('/bin/sh', ['-lc', command], workspaceRoot, timeoutMs);
  }

  // workspace-write mode — sandbox theo platform
  if (process.platform === 'darwin') {
    const sandboxExec = '/usr/bin/sandbox-exec';
    let sandboxExists = false;
    try {
      await fs.access(sandboxExec);
      sandboxExists = true;
    } catch {
      sandboxExists = false;
    }
    if (!sandboxExists) {
      return { ok: false, output: 'sandbox-exec not found; refusing to run command in workspace-write mode.' };
    }
    const profile = buildSeatbeltProfile(workspaceRoot);
    return spawnAndCollect(sandboxExec, ['-p', profile, '/bin/sh', '-lc', command], workspaceRoot, timeoutMs);
  }

  if (process.platform === 'linux') {
    const pathEntries = (process.env.PATH || '').split(path.delimiter);
    let bwrapFound = false;
    for (const entry of pathEntries) {
      try {
        await fs.access(path.join(entry, 'bwrap'));
        bwrapFound = true;
        break;
      } catch {
        // không có trong entry này, thử tiếp
      }
    }
    if (!bwrapFound) {
      return { ok: false, output: 'bubblewrap (bwrap) not found; refusing to run command in workspace-write mode.' };
    }
    return spawnAndCollect('bwrap', [
      '--ro-bind', '/', '/',
      '--dev', '/dev',
      '--proc', '/proc',
      '--tmpfs', '/tmp',
      '--bind', workspaceRoot, workspaceRoot,
      '--chdir', workspaceRoot,
      '--unshare-net',
      '/bin/sh', '-lc', command,
    ], workspaceRoot, timeoutMs);
  }

  if (process.platform === 'win32') {
    // workspace-write trên Windows chưa có sandbox — fail rõ ràng
    return {
      ok: false,
      output: [
        'Sandboxed command execution (workspace-write mode) is not yet implemented on Windows.',
        'Options:',
        '  1. Switch to "danger-full-access" mode if you understand the risks.',
        '  2. Use WSL2 to run commands in a Linux sandbox.',
        '  3. Run the app on macOS or Linux for full sandbox support.',
      ].join('\n'),
    };
  }

  return { ok: false, output: `Sandboxed command execution is not implemented on ${process.platform}.` };
}
