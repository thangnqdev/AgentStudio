import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  MAX_WORKER_PROCESS_MESSAGE_BYTES,
  parseWorkerProcessBootstrap,
  parseWorkerProcessMessage,
  type AgentWorkerProcessRequest,
  type AgentWorkerProcessResponse,
  type AgentWorkerProcessResult,
} from '../../domain/entities/agentWorkerSessionProcess.js';
import type {
  IAgentWorkerSessionProcessHost,
  AgentWorkerSessionProcessCallbacks,
} from '../../domain/ports/IAgentWorkerSessionProcessHost.js';

const MAX_CAPTURED_OUTPUT_BYTES = 64_000;
const MAX_CONCURRENT_REQUESTS = 64;
const FORCE_KILL_DELAY_MS = 5_000;
const SAFE_ENVIRONMENT_KEYS = [
  'PATH', 'HOME', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'TEMP', 'TMP',
  'TERM', 'USER', 'LOGNAME', 'SHELL', 'SystemRoot', 'WINDIR', 'ComSpec', 'PATHEXT',
] as const;

export class LocalAgentWorkerSessionProcessHost implements IAgentWorkerSessionProcessHost {
  private readonly entryPath: string;
  private readonly entryArguments: string[];
  private readonly runtimeArguments: string[];

  constructor(entryPath: string, entryArguments: string[] = [], runtimeArguments: string[] = []) {
    this.entryPath = path.resolve(entryPath);
    if (!validArguments(entryArguments, 10) || !validArguments(runtimeArguments, 4)) {
      throw new Error('Agent worker entry arguments are invalid.');
    }
    this.entryArguments = [...entryArguments];
    this.runtimeArguments = [...runtimeArguments];
  }

  async run(
    input: Parameters<IAgentWorkerSessionProcessHost['run']>[0],
    callbacks: AgentWorkerSessionProcessCallbacks,
    signal: AbortSignal,
  ) {
    if (signal.aborted) throw new Error('Agent worker process was stopped.');
    const { entry, cwd, bootstrap } = await this.validate(input);
    const child = spawn(process.execPath, [...this.runtimeArguments, entry, ...this.entryArguments], {
      cwd, shell: false, windowsHide: true,
      env: { ...safeEnvironment(), ELECTRON_RUN_AS_NODE: '1', AGENTSTUDIO_WORKER_BOOTSTRAP_FD: '3' },
      stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'ipc'],
    });
    const channel = child.stdio[3];
    if (!channel || !('write' in channel)) { child.kill(); throw new Error('Agent worker bootstrap channel is unavailable.'); }
    channel.end(bootstrap);
    return collectSession(child, callbacks, signal);
  }

  private async validate(input: Parameters<IAgentWorkerSessionProcessHost['run']>[0]) {
    const entry = await fs.realpath(this.entryPath);
    const entryStat = await fs.lstat(entry);
    if (!entryStat.isFile() || entryStat.isSymbolicLink()) throw new Error('Agent worker session entrypoint is unsafe.');
    const cwd = await fs.realpath(input.cwd);
    const cwdStat = await fs.lstat(cwd);
    if (!cwdStat.isDirectory() || cwdStat.isSymbolicLink()) throw new Error('Agent worker session cwd is unsafe.');
    const parsed = parseWorkerProcessBootstrap(input.bootstrap);
    const bootstrap = JSON.stringify(parsed);
    if (Buffer.byteLength(bootstrap) > MAX_WORKER_PROCESS_MESSAGE_BYTES) throw new Error('Agent worker session bootstrap is too large.');
    return { entry, cwd, bootstrap };
  }
}

function collectSession(child: ChildProcess, callbacks: AgentWorkerSessionProcessCallbacks, signal: AbortSignal) {
  return new Promise<{ status: 'completed' | 'paused'; completedSteps: number }>((resolve, reject) => {
    let stdout = ''; let stderr = ''; let finalResult: AgentWorkerProcessResult | undefined;
    let violation = ''; let forceKill: NodeJS.Timeout | undefined; let settled = false;
    const active = new Set<string>();
    const append = (current: string, chunk: Buffer) => {
      const next = current + chunk.toString('utf8');
      if (Buffer.byteLength(next) > MAX_CAPTURED_OUTPUT_BYTES) protocolViolation('Agent worker process output exceeded its limit.');
      return next.slice(-MAX_CAPTURED_OUTPUT_BYTES);
    };
    const protocolViolation = (message: string) => {
      if (violation) return;
      violation = message; terminate(child);
      forceKill = setTimeout(() => child.kill('SIGKILL'), FORCE_KILL_DELAY_MS); forceKill.unref();
    };
    const abort = () => protocolViolation('Agent worker process was stopped.');
    signal.addEventListener('abort', abort, { once: true });
    child.stdout?.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr?.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk); });
    child.on('message', (raw: unknown) => {
      try {
        if (Buffer.byteLength(JSON.stringify(raw)) > MAX_WORKER_PROCESS_MESSAGE_BYTES) throw new Error('Agent worker IPC message is too large.');
        const message = parseWorkerProcessMessage(raw);
        if (message.kind === 'request') {
          if (active.has(message.id) || active.size >= MAX_CONCURRENT_REQUESTS) throw new Error('Agent worker request concurrency is invalid.');
          active.add(message.id);
          void dispatch(message, callbacks).then(
            (result) => send(child, { kind: 'response', id: message.id, ok: true, result }),
            (error) => send(child, { kind: 'response', id: message.id, ok: false, error: errorMessage(error) }),
          ).finally(() => active.delete(message.id));
          return;
        }
        if (message.kind === 'event') { callbacks.emit(message); return; }
        if (message.kind === 'result') {
          if (finalResult) throw new Error('Agent worker sent more than one final result.');
          finalResult = message; return;
        }
        throw new Error('Agent worker sent a response on the parent channel.');
      } catch (error) {
        protocolViolation(errorMessage(error));
      }
    });
    child.once('error', (error) => { if (!settled) { settled = true; cleanup(); reject(error); } });
    child.once('close', (code) => {
      if (settled) return;
      settled = true; cleanup();
      if (signal.aborted || violation) { reject(new Error(violation || 'Agent worker process was stopped.')); return; }
      if (!finalResult) { reject(new Error(`Agent worker process exited without a result (code ${code ?? -1}).${stderr ? ` ${stderr.trim()}` : ''}`)); return; }
      if (!finalResult.ok) { reject(new Error(finalResult.error)); return; }
      if (code !== 0 || !finalResult.status || finalResult.completedSteps === undefined) {
        reject(new Error(`Agent worker process failed with exit code ${code ?? -1}.`)); return;
      }
      resolve({ status: finalResult.status, completedSteps: finalResult.completedSteps });
    });
    function cleanup() {
      if (forceKill) clearTimeout(forceKill);
      signal.removeEventListener('abort', abort);
    }
  });
}

function dispatch(request: AgentWorkerProcessRequest, callbacks: AgentWorkerSessionProcessCallbacks): Promise<unknown> {
  if (request.method === 'tools.list') return callbacks.listTools();
  if (request.method === 'tool.run') return callbacks.runTool(request.payload);
  if (request.method === 'checkpoint') return callbacks.checkpoint(request.payload).then(() => null);
  if (request.method === 'messages.drain') return callbacks.drainMessages();
  if (request.method === 'hook.dispatch') return callbacks.dispatchHook(request.payload.event).then(() => null);
  return callbacks.recordSpan(request.payload);
}

function send(child: ChildProcess, message: AgentWorkerProcessResponse) {
  if (!child.connected) return;
  if (Buffer.byteLength(JSON.stringify(message)) > MAX_WORKER_PROCESS_MESSAGE_BYTES) {
    child.kill('SIGTERM'); return;
  }
  child.send?.(message, () => undefined);
}
function terminate(child: ChildProcess) { if (!child.killed) child.kill('SIGTERM'); }
function errorMessage(error: unknown) { return (error instanceof Error ? error.message : 'Agent worker process request failed.').slice(0, 2_000); }
function safeEnvironment() {
  return Object.fromEntries(SAFE_ENVIRONMENT_KEYS.flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key]!]]));
}
function validArguments(values: string[], maximum: number) {
  return values.length <= maximum && values.every((item) => Boolean(item) && item.length <= 4_000 && !item.includes('\0'));
}
