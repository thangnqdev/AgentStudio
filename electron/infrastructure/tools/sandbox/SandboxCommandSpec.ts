import fs from 'node:fs/promises';
import path from 'node:path';
import type { PermissionMode } from '../../../domain/entities/agent.js';

export type SandboxCommandSpec = {
  executable: string;
  args: string[];
  cwd: string;
};

export type SandboxCommandResolution =
  | { ok: true; spec: SandboxCommandSpec }
  | { ok: false; error: string };

export function buildSeatbeltProfile(workspaceRoot: string): string {
  const escapedWorkspace = escapeSeatbeltPath(workspaceRoot);
  const temporaryRoot = process.env.TMPDIR || process.env.TEMP || '/tmp';
  const escapedTemporaryRoot = escapeSeatbeltPath(temporaryRoot);
  return [
    '(version 1)',
    '(deny default)',
    '(allow process*)',
    '(allow signal (target self))',
    '(allow sysctl-read)',
    '(allow file-read* (subpath "/System") (subpath "/usr") (subpath "/bin") (subpath "/sbin") (subpath "/Library/Apple"))',
    `(allow file-read* (subpath "${escapedWorkspace}") (subpath "${escapedTemporaryRoot}") (subpath "/tmp") (subpath "/private/tmp"))`,
    `(allow file-write* (subpath "${escapedWorkspace}") (subpath "${escapedTemporaryRoot}") (subpath "/tmp") (subpath "/private/tmp"))`,
  ].join('\n');
}

export async function resolveSandboxCommand(
  command: string,
  workspaceRoot: string,
  permissionMode: PermissionMode,
): Promise<SandboxCommandResolution> {
  if (permissionMode === 'read-only') {
    return { ok: false, error: 'Command execution is blocked in read-only mode.' };
  }
  if (permissionMode === 'danger-full-access') {
    return process.platform === 'win32'
      ? success('cmd.exe', ['/c', command], workspaceRoot)
      : success('/bin/sh', ['-lc', command], workspaceRoot);
  }
  if (process.platform === 'darwin') {
    const sandboxExecutable = '/usr/bin/sandbox-exec';
    if (!await exists(sandboxExecutable)) {
      return { ok: false, error: 'sandbox-exec not found; refusing to run command in workspace-write mode.' };
    }
    return success(
      sandboxExecutable,
      ['-p', buildSeatbeltProfile(workspaceRoot), '/bin/sh', '-lc', command],
      workspaceRoot,
    );
  }
  if (process.platform === 'linux') {
    if (!await executableOnPath('bwrap')) {
      return { ok: false, error: 'bubblewrap (bwrap) not found; refusing to run command in workspace-write mode.' };
    }
    return success('bwrap', await buildLinuxSandboxArgs(workspaceRoot, command), workspaceRoot);
  }
  if (process.platform === 'win32') {
    return {
      ok: false,
      error: [
        'Sandboxed command execution (workspace-write mode) is not yet implemented on Windows.',
        'Switch to danger-full-access if you understand the risks, or use WSL2/macOS/Linux.',
      ].join('\n'),
    };
  }
  return { ok: false, error: `Sandboxed command execution is not implemented on ${process.platform}.` };
}

function success(executable: string, args: string[], cwd: string): SandboxCommandResolution {
  return { ok: true, spec: { executable, args, cwd } };
}

function escapeSeatbeltPath(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

async function exists(filePath: string) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function executableOnPath(name: string) {
  for (const entry of (process.env.PATH || '').split(path.delimiter)) {
    if (entry && await exists(path.join(entry, name))) return true;
  }
  return false;
}

async function buildLinuxSandboxArgs(workspaceRoot: string, command: string) {
  const systemPaths = ['/usr', '/bin', '/sbin', '/lib', '/lib64', '/etc/ld.so.cache'];
  const available = (await Promise.all(systemPaths.map(async (item) => await exists(item) ? item : ''))).filter(Boolean);
  return [
    ...available.flatMap((item) => ['--ro-bind', item, item]),
    '--dev', '/dev', '--proc', '/proc', '--tmpfs', '/tmp',
    '--bind', workspaceRoot, workspaceRoot, '--chdir', workspaceRoot, '--unshare-net',
    '/bin/sh', '-lc', command,
  ];
}
