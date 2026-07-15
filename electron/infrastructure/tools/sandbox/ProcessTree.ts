import { spawn } from 'node:child_process';

const ENV_ALLOWLIST = [
  'PATH', 'HOME', 'LANG', 'LC_ALL', 'LC_CTYPE',
  'TMPDIR', 'TEMP', 'TMP', 'TERM', 'USER', 'LOGNAME', 'SHELL',
] as const;

export function buildSafeProcessEnvironment(): Record<string, string> {
  const safeEnvironment: Record<string, string> = {};
  for (const key of ENV_ALLOWLIST) {
    const value = process.env[key];
    if (typeof value === 'string') safeEnvironment[key] = value;
  }
  return safeEnvironment;
}

export function terminateProcessTree(pid: number | undefined, signal: NodeJS.Signals) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
        env: buildSafeProcessEnvironment(),
        stdio: 'ignore',
        windowsHide: true,
      });
      return;
    }
    try {
      process.kill(-pid, signal);
    } catch {
      process.kill(pid, signal);
    }
  } catch {
    // The process can exit between inspection and termination.
  }
}
