import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import type {
  BackgroundCommandOutput,
  BackgroundCommandSnapshot,
  StartBackgroundCommandInput,
} from '../../domain/entities/backgroundCommand.js';
import { isTerminalBackgroundCommandStatus } from '../../domain/entities/backgroundCommand.js';
import type { IBackgroundCommandSupervisor } from '../../domain/ports/IBackgroundCommandSupervisor.js';
import { buildSafeProcessEnvironment, terminateProcessTree } from '../tools/sandbox/ProcessTree.js';
import { resolveSandboxCommand } from '../tools/sandbox/SandboxCommandSpec.js';
import { BackgroundCommandOutputFile } from './BackgroundCommandOutputFile.js';

const SIGKILL_GRACE_PERIOD_MS = 5_000;
const MAX_RETAINED_TASKS = 100;

type TaskRecord = {
  snapshot: BackgroundCommandSnapshot;
  child: ChildProcess;
  output: BackgroundCommandOutputFile;
  timeoutTimer: NodeJS.Timeout;
  forceKillTimer?: NodeJS.Timeout;
  terminationReason?: 'timeout' | 'output_limit' | 'stopped';
  terminal: Promise<void>;
  resolveTerminal: () => void;
  finalized: boolean;
};

export class BackgroundCommandProcessSupervisor implements IBackgroundCommandSupervisor {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly outputDirectory: string | (() => string);
  private readonly idFactory: () => string;

  constructor(outputDirectory: string | (() => string), idFactory: () => string = () => `bg-${randomUUID()}`) {
    this.outputDirectory = outputDirectory;
    this.idFactory = idFactory;
  }

  async start(input: StartBackgroundCommandInput) {
    assertStartInput(input);
    const resolution = await resolveSandboxCommand(input.command, input.workspaceRoot, input.permissionMode);
    if (!resolution.ok) throw new Error(resolution.error);
    const id = this.idFactory();
    if (this.tasks.has(id)) throw new Error('Background task ID collision.');
    const output = await BackgroundCommandOutputFile.create(this.directory(), id);
    const { executable, args, cwd } = resolution.spec;
    let child: ChildProcess;
    try {
      child = spawn(executable, args, {
        cwd,
        env: buildSafeProcessEnvironment(),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      });
    } catch (error) {
      await output.close();
      throw error;
    }
    let resolveTerminal: () => void = () => undefined;
    const terminal = new Promise<void>((resolve) => { resolveTerminal = resolve; });
    const record: TaskRecord = {
      snapshot: {
        id,
        scopeId: input.scopeId,
        command: input.command,
        description: input.description,
        workspaceRoot: input.workspaceRoot,
        permissionMode: input.permissionMode,
        status: 'running',
        startedAt: new Date().toISOString(),
        exitCode: null,
        outputBytes: 0,
        outputTruncated: false,
      },
      child,
      output,
      timeoutTimer: setTimeout(() => this.terminate(record, 'timeout'), input.timeoutMs),
      terminal,
      resolveTerminal,
      finalized: false,
    };
    record.timeoutTimer.unref();
    this.tasks.set(id, record);
    this.pruneCompletedTasks();
    child.stdout?.on('data', (chunk: Buffer) => this.appendOutput(record, chunk));
    child.stderr?.on('data', (chunk: Buffer) => this.appendOutput(record, chunk));
    child.on('error', (error) => { void this.finalize(record, null, error.message); });
    child.on('close', (code) => { void this.finalize(record, code, undefined); });
    return cloneSnapshot(record.snapshot);
  }

  async output(scopeId: string, taskId: string, options: { block: boolean; timeoutMs: number; signal?: AbortSignal }) {
    const record = this.find(scopeId, taskId);
    if (!record) return null;
    let timedOut = false;
    if (options.block && !isTerminalBackgroundCommandStatus(record.snapshot.status)) {
      timedOut = !await waitForTerminal(record.terminal, options.timeoutMs, options.signal);
    }
    const snapshot = cloneSnapshot(record.snapshot);
    const retrievalStatus: BackgroundCommandOutput['retrievalStatus'] = timedOut
      ? 'timeout'
      : isTerminalBackgroundCommandStatus(snapshot.status) ? 'success' : 'not_ready';
    return { retrievalStatus, task: snapshot, output: await record.output.readTail() };
  }

  async stop(scopeId: string, taskId: string) {
    const record = this.find(scopeId, taskId);
    if (!record) return null;
    if (isTerminalBackgroundCommandStatus(record.snapshot.status)) {
      throw new Error(`Background command ${taskId} is not running (status: ${record.snapshot.status}).`);
    }
    this.terminate(record, 'stopped');
    return cloneSnapshot(record.snapshot);
  }

  async stopAll() {
    for (const record of this.tasks.values()) {
      if (!isTerminalBackgroundCommandStatus(record.snapshot.status)) {
        this.terminate(record, 'stopped');
        terminateProcessTree(record.child.pid, 'SIGKILL');
      }
    }
    await Promise.allSettled([...this.tasks.values()].map((record) => record.terminal));
  }

  private appendOutput(record: TaskRecord, chunk: Buffer) {
    const exceeded = record.output.append(chunk);
    record.snapshot.outputBytes = record.output.outputBytes;
    record.snapshot.outputTruncated = record.output.truncated;
    if (exceeded) this.terminate(record, 'output_limit');
  }

  private terminate(record: TaskRecord, reason: TaskRecord['terminationReason']) {
    if (record.terminationReason || isTerminalBackgroundCommandStatus(record.snapshot.status)) return;
    record.terminationReason = reason;
    if (reason === 'stopped') {
      record.snapshot.status = 'stopped';
      record.snapshot.endedAt = new Date().toISOString();
    } else {
      record.snapshot.error = reason === 'timeout'
        ? 'Background command timed out.'
        : 'Background command exceeded the output limit.';
    }
    terminateProcessTree(record.child.pid, 'SIGTERM');
    record.forceKillTimer = setTimeout(() => terminateProcessTree(record.child.pid, 'SIGKILL'), SIGKILL_GRACE_PERIOD_MS);
    record.forceKillTimer.unref();
  }

  private async finalize(record: TaskRecord, exitCode: number | null, spawnError?: string) {
    if (record.finalized) return;
    record.finalized = true;
    clearTimeout(record.timeoutTimer);
    if (record.forceKillTimer) clearTimeout(record.forceKillTimer);
    record.snapshot.exitCode = exitCode;
    record.snapshot.outputBytes = record.output.outputBytes;
    record.snapshot.outputTruncated = record.output.truncated;
    record.snapshot.endedAt ||= new Date().toISOString();
    if (record.terminationReason === 'stopped') record.snapshot.status = 'stopped';
    else if (record.terminationReason || spawnError || exitCode !== 0) record.snapshot.status = 'failed';
    else record.snapshot.status = 'completed';
    if (spawnError) record.snapshot.error = spawnError;
    try {
      await record.output.close();
    } catch {
      record.snapshot.error ||= 'Unable to finalize background command output.';
      record.snapshot.status = 'failed';
    } finally {
      record.resolveTerminal();
    }
  }

  private find(scopeId: string, taskId: string) {
    const record = this.tasks.get(taskId);
    return record?.snapshot.scopeId === scopeId ? record : undefined;
  }

  private directory() {
    const directory = typeof this.outputDirectory === 'function' ? this.outputDirectory() : this.outputDirectory;
    if (!directory) throw new Error('Background command output directory is unavailable.');
    return directory;
  }

  private pruneCompletedTasks() {
    if (this.tasks.size <= MAX_RETAINED_TASKS) return;
    const removable = [...this.tasks.values()]
      .filter((record) => isTerminalBackgroundCommandStatus(record.snapshot.status))
      .sort((a, b) => a.snapshot.startedAt.localeCompare(b.snapshot.startedAt));
    while (this.tasks.size > MAX_RETAINED_TASKS && removable.length) {
      const record = removable.shift();
      if (!record) break;
      this.tasks.delete(record.snapshot.id);
      void fs.rm(record.output.outputPath, { force: true }).catch(() => undefined);
    }
  }
}

function assertStartInput(input: StartBackgroundCommandInput) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(input.scopeId)) throw new Error('Background command scope is invalid.');
  if (!input.command || input.command.length > 20_000) throw new Error('Background command is invalid.');
  if (!input.description || input.description.length > 500) throw new Error('Background command description is invalid.');
  if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 1_000 || input.timeoutMs > 600_000) throw new Error('Background command timeout is invalid.');
}

function cloneSnapshot(snapshot: BackgroundCommandSnapshot) {
  return { ...snapshot };
}

async function waitForTerminal(terminal: Promise<void>, timeoutMs: number, signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('Agent session stopped.');
  let timer: NodeJS.Timeout | undefined;
  let abort: (() => void) | undefined;
  const timedOut = new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); });
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(new Error('Agent session stopped.'));
    signal?.addEventListener('abort', abort, { once: true });
  });
  try {
    return await Promise.race([terminal.then(() => true as const), timedOut, aborted]);
  } finally {
    if (timer) clearTimeout(timer);
    if (abort) signal?.removeEventListener('abort', abort);
  }
}
