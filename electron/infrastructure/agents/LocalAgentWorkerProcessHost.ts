import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentWorkerProcessBootstrap, IAgentWorkerProcessHost } from '../../domain/ports/IAgentWorkerProcessHost.js';

const MAX_BOOTSTRAP_BYTES = 64_000;
const MAX_OUTPUT_BYTES = 64_000;
const FORCE_KILL_DELAY_MS = 5_000;
const SAFE_ENVIRONMENT_KEYS = [
  'PATH', 'HOME', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'TEMP', 'TMP',
  'TERM', 'USER', 'LOGNAME', 'SHELL', 'SystemRoot', 'WINDIR',
] as const;

export class LocalAgentWorkerProcessHost implements IAgentWorkerProcessHost {
  private readonly entryPath: string;

  constructor(entryPath: string) { this.entryPath = path.resolve(entryPath); }

  async run(input: { cwd: string; bootstrap: AgentWorkerProcessBootstrap }, signal?: AbortSignal) {
    const { entry, cwd } = await this.validate(input);
    const child = spawn(process.execPath, [entry], {
      cwd, shell: false, windowsHide: true,
      env: { ...safeEnvironment(), ELECTRON_RUN_AS_NODE: '1', AGENTSTUDIO_BOOTSTRAP_FD: '3' },
      stdio: ['ignore', 'pipe', 'pipe', 'pipe'],
    });
    const bootstrap = Buffer.from(JSON.stringify(input.bootstrap));
    const channel = child.stdio[3];
    if (!channel || !('write' in channel)) { child.kill(); throw new Error('Agent worker bootstrap channel is unavailable.'); }
    channel.end(bootstrap);
    return await collect(child, signal);
  }

  private async validate(input: { cwd: string; bootstrap: AgentWorkerProcessBootstrap }) {
    const entry = await fs.realpath(this.entryPath);
    const entryStat = await fs.lstat(entry);
    if (!entryStat.isFile() || entryStat.isSymbolicLink()) throw new Error('Agent worker entrypoint is unsafe.');
    const cwd = await fs.realpath(input.cwd);
    const cwdStat = await fs.lstat(cwd);
    if (!cwdStat.isDirectory() || cwdStat.isSymbolicLink()) throw new Error('Agent worker cwd is unsafe.');
    validateBootstrap(input.bootstrap);
    if (Buffer.byteLength(JSON.stringify(input.bootstrap)) > MAX_BOOTSTRAP_BYTES) throw new Error('Agent worker bootstrap is too large.');
    return { entry, cwd };
  }
}

function collect(child: ChildProcess, signal?: AbortSignal) {
  return new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve, reject) => {
    let stdout = ''; let stderr = ''; let exceeded = false; let forceKill: ReturnType<typeof setTimeout> | undefined;
    const append = (current: string, chunk: Buffer) => {
      const next = current + chunk.toString('utf8');
      if (Buffer.byteLength(next) > MAX_OUTPUT_BYTES) { exceeded = true; terminate(child); }
      return next.slice(-MAX_OUTPUT_BYTES);
    };
    child.stdout?.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk); });
    const abort = () => { terminate(child); forceKill = setTimeout(() => child.kill('SIGKILL'), FORCE_KILL_DELAY_MS); forceKill.unref(); };
    signal?.addEventListener('abort', abort, { once: true });
    child.once('error', reject);
    child.once('close', (code) => {
      if (forceKill) clearTimeout(forceKill); signal?.removeEventListener('abort', abort);
      if (exceeded) { reject(new Error('Agent worker process output exceeded its limit.')); return; }
      if (signal?.aborted) { reject(new Error('Agent worker process was stopped.')); return; }
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });
  });
}

function terminate(child: ChildProcess) { if (!child.killed) child.kill('SIGTERM'); }

function safeEnvironment() {
  return Object.fromEntries(SAFE_ENVIRONMENT_KEYS.flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]!]]));
}

function validateBootstrap(value: AgentWorkerProcessBootstrap) {
  for (const field of ['endpoint', 'teamId', 'workerId', 'instanceId'] as const) {
    if (!value[field] || value[field].length > 1_024 || value[field].includes('\0')) throw new Error('Agent worker bootstrap identity is invalid.');
  }
  if (!Number.isSafeInteger(value.epoch) || value.epoch <= 0 || !/^[A-Za-z0-9_-]{43}$/.test(value.secret)) {
    throw new Error('Agent worker bootstrap credential is invalid.');
  }
}
