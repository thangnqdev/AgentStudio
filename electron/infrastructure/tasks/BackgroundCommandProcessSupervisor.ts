import { randomBytes, randomUUID } from 'node:crypto';
import type {
  BackgroundCommandOutput,
  BackgroundCommandSnapshot,
  StartBackgroundCommandInput,
} from '../../domain/entities/backgroundCommand.js';
import { isTerminalBackgroundCommandStatus } from '../../domain/entities/backgroundCommand.js';
import type { IBackgroundCommandSupervisor } from '../../domain/ports/IBackgroundCommandSupervisor.js';
import type { IBackgroundCommandCompletionSource } from '../../domain/ports/IBackgroundCommandCompletionSource.js';
import type { IBackgroundCommandNoticeSource } from '../../domain/ports/IBackgroundCommandNoticeSource.js';
import { resolveSandboxCommand } from '../tools/sandbox/SandboxCommandSpec.js';
import type { BackgroundCommandProcessHost } from './BackgroundCommandProcessHost.js';
import { BackgroundCommandTaskStore } from './BackgroundCommandTaskStore.js';
import type { BackgroundCommandProcessState } from './backgroundCommandProcessProtocol.js';

const MAX_RETAINED_TASKS = 100;
const STOP_WAIT_MS = 7_000;
const POLL_INTERVAL_MS = 40;

type ProcessLauncher = Pick<BackgroundCommandProcessHost, 'start'>;

export class BackgroundCommandProcessSupervisor implements IBackgroundCommandSupervisor, IBackgroundCommandCompletionSource, IBackgroundCommandNoticeSource {
  private readonly store: BackgroundCommandTaskStore;
  private readonly launcher: ProcessLauncher;
  private readonly idFactory: () => string;
  private notificationQueue: Promise<void> = Promise.resolve();

  constructor(
    outputDirectory: string | (() => string),
    launcher: ProcessLauncher,
    idFactory: () => string = () => `bg-${randomUUID()}`,
  ) {
    this.store = new BackgroundCommandTaskStore(outputDirectory);
    this.launcher = launcher;
    this.idFactory = idFactory;
  }

  async start(input: StartBackgroundCommandInput) {
    assertStartInput(input);
    const resolution = await resolveSandboxCommand(input.command, input.workspaceRoot, input.permissionMode, input.shell);
    if (!resolution.ok) throw new Error(resolution.error);
    const directory = await this.store.prepare();
    const id = this.idFactory();
    if (await this.store.readState(id)) throw new Error('Background task ID collision.');
    const startedAt = new Date();
    const state: BackgroundCommandProcessState = {
      version: 1,
      snapshot: {
        id,
        scopeId: input.scopeId,
        command: input.command,
        description: input.description,
        workspaceRoot: input.workspaceRoot,
        permissionMode: input.permissionMode,
        status: 'running',
        startedAt: startedAt.toISOString(),
        exitCode: null,
        outputBytes: 0,
        outputTruncated: false,
      },
      timeoutAt: new Date(startedAt.getTime() + input.timeoutMs).toISOString(),
      heartbeatAt: startedAt.toISOString(),
      controlToken: randomBytes(32).toString('base64url'),
      supervisorPid: process.pid,
    };
    await this.launcher.start(
      { version: 1, directory, state, command: resolution.spec },
      async () => Boolean(await this.store.readState(id)),
    );
    const persisted = await this.store.readState(id);
    if (!persisted) throw new Error('Background command did not persist its initial state.');
    await this.store.prune(MAX_RETAINED_TASKS).catch(() => undefined);
    return cloneSnapshot(persisted.snapshot);
  }

  async output(scopeId: string, taskId: string, options: { block: boolean; timeoutMs: number; signal?: AbortSignal }) {
    let state = await this.find(scopeId, taskId);
    if (!state) return null;
    let timedOut = false;
    if (options.block && !isTerminalBackgroundCommandStatus(state.snapshot.status)) {
      const result = await this.waitForTerminal(taskId, options.timeoutMs, options.signal);
      state = result.state || state;
      timedOut = result.timedOut;
    }
    const snapshot = cloneSnapshot(state.snapshot);
    const retrievalStatus: BackgroundCommandOutput['retrievalStatus'] = timedOut
      ? 'timeout'
      : isTerminalBackgroundCommandStatus(snapshot.status) ? 'success' : 'not_ready';
    return { retrievalStatus, task: snapshot, output: await this.store.readOutputTail(taskId) };
  }

  async stop(scopeId: string, taskId: string) {
    const state = await this.find(scopeId, taskId);
    if (!state) return null;
    if (isTerminalBackgroundCommandStatus(state.snapshot.status)) {
      throw new Error(`Background command ${taskId} is not running (status: ${state.snapshot.status}).`);
    }
    await this.store.requestStop(taskId, state.controlToken);
    const terminal = await this.waitForTerminal(taskId, STOP_WAIT_MS);
    return cloneSnapshot((terminal.state || state).snapshot);
  }

  async stopAll() {
    const running = (await this.store.listStates())
      .filter((state) => !isTerminalBackgroundCommandStatus(state.snapshot.status));
    await Promise.allSettled(running.map(async (state) => {
      await this.store.requestStop(state.snapshot.id, state.controlToken);
      await this.waitForTerminal(state.snapshot.id, STOP_WAIT_MS);
    }));
  }

  drainCompleted(scopeId: string) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(scopeId)) return Promise.resolve([]);
    const operation = this.notificationQueue.catch(() => undefined).then(async () => {
      const states = (await this.store.listStates())
        .filter((state) => state.snapshot.scopeId === scopeId
          && isTerminalBackgroundCommandStatus(state.snapshot.status)
          && !state.notificationDeliveredAt)
        .sort((left, right) => (left.snapshot.endedAt ?? left.snapshot.startedAt)
          .localeCompare(right.snapshot.endedAt ?? right.snapshot.startedAt))
        .slice(0, 10);
      const completions = [];
      for (const state of states) {
        const output = await this.store.readOutputTail(state.snapshot.id, 20_000);
        state.notificationDeliveredAt = new Date().toISOString();
        await this.store.writeState(state);
        completions.push({ task: cloneSnapshot(state.snapshot), output });
      }
      return completions;
    });
    this.notificationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  drainRendererNotices() {
    const operation = this.notificationQueue.catch(() => undefined).then(async () => {
      const states = (await this.store.listStates())
        .filter((state) => isTerminalBackgroundCommandStatus(state.snapshot.status) && !state.rendererDeliveredAt)
        .sort((left, right) => (left.snapshot.endedAt ?? left.snapshot.startedAt)
          .localeCompare(right.snapshot.endedAt ?? right.snapshot.startedAt))
        .slice(0, 25);
      const notices = [];
      for (const state of states) {
        const task = state.snapshot;
        state.rendererDeliveredAt = new Date().toISOString();
        await this.store.writeState(state);
        notices.push({
          workspaceRoot: task.workspaceRoot,
          notice: {
            id: task.id, scopeId: task.scopeId, description: task.description,
            status: task.status as Exclude<typeof task.status, 'running'>,
            endedAt: task.endedAt ?? task.startedAt, exitCode: task.exitCode,
            ...(task.error ? { error: task.error } : {}),
          },
        });
      }
      return notices;
    });
    this.notificationQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  private async find(scopeId: string, taskId: string) {
    const state = await this.store.readState(taskId);
    return state?.snapshot.scopeId === scopeId ? state : null;
  }

  private async waitForTerminal(taskId: string, timeoutMs: number, signal?: AbortSignal) {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      if (signal?.aborted) throw new Error('Agent session stopped.');
      const state = await this.store.readState(taskId);
      if (!state || isTerminalBackgroundCommandStatus(state.snapshot.status)) return { state, timedOut: false };
      if (Date.now() >= deadline) return { state, timedOut: true };
      await abortableDelay(Math.min(POLL_INTERVAL_MS, Math.max(1, deadline - Date.now())), signal);
    }
  }
}

function assertStartInput(input: StartBackgroundCommandInput) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(input.scopeId)) throw new Error('Background command scope is invalid.');
  if (!input.command || input.command.length > 20_000) throw new Error('Background command is invalid.');
  if (!input.description || input.description.length > 500) throw new Error('Background command description is invalid.');
  if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 1_000 || input.timeoutMs > 600_000) throw new Error('Background command timeout is invalid.');
  if (input.shell !== undefined && input.shell !== 'powershell') throw new Error('Background command shell is invalid.');
}

function cloneSnapshot(snapshot: BackgroundCommandSnapshot) { return { ...snapshot }; }

function abortableDelay(timeoutMs: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(done, timeoutMs);
    const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new Error('Agent session stopped.')); };
    function done() { signal?.removeEventListener('abort', abort); resolve(); }
    signal?.addEventListener('abort', abort, { once: true });
  });
}
