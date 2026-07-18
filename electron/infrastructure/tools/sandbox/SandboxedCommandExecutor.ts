import { spawn } from 'node:child_process';
import type { ToolResult, PermissionMode } from '../../../domain/entities/agent.js';
import { buildSafeProcessEnvironment, terminateProcessTree } from './ProcessTree.js';
import { resolveSandboxCommand } from './SandboxCommandSpec.js';
import type { CommandShell } from '../../../domain/entities/backgroundCommand.js';

export { buildSeatbeltProfile } from './SandboxCommandSpec.js';

const MAX_COMMAND_OUTPUT = 40_000;
const SIGKILL_GRACE_PERIOD_MS = 5_000;

function trimOutput(output: string): string {
  if (output.length <= MAX_COMMAND_OUTPUT) return output;
  return `${output.slice(0, MAX_COMMAND_OUTPUT)}\n[output truncated]`;
}

export function spawnAndCollect(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
  gracePeriodMs = SIGKILL_GRACE_PERIOD_MS,
  signal?: AbortSignal,
): Promise<ToolResult> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ ok: false, output: 'Command cancelled.' });
      return;
    }
    const child = spawn(command, args, {
      cwd,
      env: buildSafeProcessEnvironment(),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let output = '';
    let resolved = false;
    let closed = false;
    let forceKillTimer: NodeJS.Timeout | undefined;

    const settle = (result: ToolResult) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };
    const terminate = (message: string) => {
      if (closed || resolved) return;
      terminateProcessTree(child.pid, 'SIGTERM');
      forceKillTimer = setTimeout(() => {
        if (!closed) terminateProcessTree(child.pid, 'SIGKILL');
      }, gracePeriodMs);
      settle({ ok: false, output: trimOutput(`${output}\n${message}`) });
    };
    const timeoutTimer = setTimeout(() => terminate(`Command timed out after ${timeoutMs}ms.`), timeoutMs);
    const abort = () => terminate('Command cancelled.');
    signal?.addEventListener('abort', abort, { once: true });
    const cleanup = () => {
      clearTimeout(timeoutTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      signal?.removeEventListener('abort', abort);
    };

    child.stdout.on('data', (chunk: Buffer) => { output = trimOutput(output + chunk.toString('utf8')); });
    child.stderr.on('data', (chunk: Buffer) => { output = trimOutput(output + chunk.toString('utf8')); });
    child.on('error', (error) => {
      closed = true;
      cleanup();
      settle({ ok: false, output: error.message });
    });
    child.on('close', (code) => {
      closed = true;
      cleanup();
      settle({ ok: code === 0, output: trimOutput(`${output}\nExit code: ${code ?? 'unknown'}`) });
    });
  });
}

export async function runSandboxedCommand(
  command: string,
  workspaceRoot: string,
  permissionMode: PermissionMode,
  timeoutMs: number,
  signal?: AbortSignal,
  shell?: CommandShell,
): Promise<ToolResult> {
  const resolution = await resolveSandboxCommand(command, workspaceRoot, permissionMode, shell);
  if (!resolution.ok) return { ok: false, output: resolution.error };
  const { executable, args, cwd } = resolution.spec;
  return spawnAndCollect(executable, args, cwd, timeoutMs, SIGKILL_GRACE_PERIOD_MS, signal);
}
