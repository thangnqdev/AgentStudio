import { describe, expect, it, vi } from 'vitest';
import type { Message } from '../../domain/entities/agent.js';
import type { AgentWorkerCheckpoint, AgentWorkerNotification, AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import type { IAgentWorkerRepository } from '../../domain/ports/IAgentWorkerRepository.js';
import type { IAgentWorkerRunner } from '../../domain/ports/IAgentWorkerRunner.js';
import { ManageAgentWorkers } from './ManageAgentWorkers.js';

describe('ManageAgentWorkers', () => {
  it('runs a foreground worker with a non-escalating permission mode', async () => {
    const repository = new MemoryWorkerRepository();
    const runner: IAgentWorkerRunner = { run: async (worker, callbacks) => {
      await callbacks.checkpoint({ ...worker, status: 'completed', updatedAt: now(), completedSteps: 2, result: 'done' });
      return { status: 'completed', completedSteps: 2, result: 'done' };
    } };
    const manager = createManager(repository);
    const result = await manager.spawn(
      { description: 'Review auth flow', prompt: 'Review it', runInBackground: false, mode: 'read-only', name: 'reviewer' },
      parent('workspace-write'), execution(runner),
    );
    expect(result.background).toBe(false);
    expect(result.worker).toMatchObject({ name: 'reviewer', status: 'completed', result: 'done', permissionMode: 'read-only' });
    await expect(manager.spawn(
      { description: 'Escalate permissions', prompt: 'Do it', runInBackground: false, mode: 'danger-full-access' },
      parent('workspace-write'), execution(runner),
    )).rejects.toThrow('cannot exceed');
  });

  it('queues same-turn messages for a running background worker and notifies its parent', async () => {
    const repository = new MemoryWorkerRepository();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let received: Message[] = [];
    const runner: IAgentWorkerRunner = { run: async (_worker, callbacks) => {
      await gate;
      received = await callbacks.drainMessages();
      return { status: 'completed', completedSteps: 1, result: 'background result' };
    } };
    const manager = createManager(repository);
    const launched = await manager.spawn(
      { description: 'Inspect flaky tests', prompt: 'Inspect them', runInBackground: true, name: 'tester' },
      parent('workspace-write'), execution(runner),
    );
    expect(launched.background).toBe(true);
    await manager.send(
      { to: 'tester', summary: 'Please focus on timeout failures first', message: 'Focus on timeouts.' },
      parent('workspace-write'), execution(runner),
    );
    release();
    await waitFor(async () => (await manager.list('scope'))[0]?.status === 'completed');
    expect(received.map((message) => message.content)).toEqual(['Focus on timeouts.']);
    expect((await manager.drainParentMessages('scope'))[0]?.content).toContain('background result');
  });

  it('waits for every background worker in the parent scope and returns all results', async () => {
    const repository = new MemoryWorkerRepository();
    const releases: Array<() => void> = [];
    const runner: IAgentWorkerRunner = { run: async (worker) => {
      await new Promise<void>((resolve) => { releases.push(resolve); });
      return { status: 'completed', completedSteps: 1, result: `${worker.name} result` };
    } };
    const manager = createManager(repository);
    await manager.spawn(
      { description: 'Review UX', prompt: 'Review it', runInBackground: true, name: 'ux' },
      parent('workspace-write'), execution(runner),
    );
    await manager.spawn(
      { description: 'Review architecture', prompt: 'Review it', runInBackground: true, name: 'architecture' },
      parent('workspace-write'), execution(runner),
    );

    let settled = false;
    const resultsPromise = manager.waitForBackgroundResults('scope').then((results) => {
      settled = true;
      return results;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    releases[0]();
    await Promise.resolve();
    expect(settled).toBe(false);
    releases[1]();

    const results = await resultsPromise;
    expect(results).toHaveLength(2);
    expect(results.map((message) => message.content).join('\n')).toContain('ux result');
    expect(results.map((message) => message.content).join('\n')).toContain('architecture result');
  });

  it('stops waiting promptly when the lead session is aborted', async () => {
    const repository = new MemoryWorkerRepository();
    const runner: IAgentWorkerRunner = { run: async (_worker, _callbacks, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }) };
    const manager = createManager(repository);
    await manager.spawn(
      { description: 'Long review', prompt: 'Keep reviewing', runInBackground: true, name: 'reviewer' },
      parent('workspace-write'), execution(runner),
    );
    const controller = new AbortController();
    const waiting = manager.waitForBackgroundResults('scope', controller.signal);
    controller.abort();
    await expect(waiting).rejects.toThrow('stopped');
    await manager.stopAll();
  });

  it('resumes a completed transcript when SendMessage targets it', async () => {
    const repository = new MemoryWorkerRepository();
    const prompts: string[][] = [];
    const runner: IAgentWorkerRunner = { run: async (worker) => {
      prompts.push(worker.messages.map((message) => message.content));
      return { status: 'completed', completedSteps: prompts.length, result: `run-${prompts.length}` };
    } };
    const manager = createManager(repository);
    await manager.spawn(
      { description: 'Inspect auth code', prompt: 'First prompt', runInBackground: false, name: 'reviewer' },
      parent('workspace-write'), execution(runner),
    );
    await manager.send(
      { to: 'reviewer', summary: 'Please continue with the timeout path', message: 'Second prompt' },
      parent('workspace-write'), execution(runner),
    );
    await waitFor(() => prompts.length === 2);
    expect(prompts[1]).toEqual(['First prompt', 'Second prompt']);
  });

  it('keeps addressable names unique after a worker completes', async () => {
    const repository = new MemoryWorkerRepository();
    const runner: IAgentWorkerRunner = { run: async () => ({ status: 'completed', completedSteps: 1, result: 'done' }) };
    const manager = createManager(repository);
    await manager.spawn(
      { description: 'First review', prompt: 'Review it', runInBackground: false, name: 'reviewer' },
      parent('workspace-write'), execution(runner),
    );

    await expect(manager.spawn(
      { description: 'Second review', prompt: 'Review again', runInBackground: false, name: 'reviewer' },
      parent('workspace-write'), execution(runner),
    )).rejects.toThrow('already exists');
  });

  it('delivers a graceful shutdown request instead of aborting immediately', async () => {
    const repository = new MemoryWorkerRepository();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let received: Message[] = [];
    const runner: IAgentWorkerRunner = { run: async (_worker, callbacks) => {
      await gate;
      received = await callbacks.drainMessages();
      return { status: 'completed', completedSteps: 1, result: 'stopped gracefully' };
    } };
    const manager = createManager(repository);
    await manager.spawn(
      { description: 'Long review', prompt: 'Wait for control', runInBackground: true, name: 'reviewer' },
      parent('workspace-write'), execution(runner),
    );

    const result = await manager.send(
      { to: 'reviewer', message: { type: 'shutdown_request', reason: 'Parent is done.' } },
      parent('workspace-write'), execution(runner),
    );

    expect(result).toEqual(['reviewer: shutdown requested']);
    expect((await manager.list('scope'))[0]?.status).toBe('running');
    release();
    await waitFor(async () => (await manager.list('scope'))[0]?.status === 'completed');
    expect(received.map((message) => JSON.parse(message.content))).toEqual([
      { type: 'shutdown_request', reason: 'Parent is done.' },
    ]);
  });
});

function createManager(repository: IAgentWorkerRepository) {
  return new ManageAgentWorkers(repository, {
    newSpanId: () => 'span', startTrace: vi.fn(async () => undefined), updateTrace: vi.fn(async () => undefined), recordSpan: vi.fn(async () => 'span'),
  });
}

function parent(permissionMode: 'read-only' | 'workspace-write' | 'danger-full-access') {
  return { parentScopeId: 'scope', workspaceRoot: '/workspace', permissionMode, depth: 0 };
}

function execution(runner: IAgentWorkerRunner) {
  return { runner, events: { emitWorker: vi.fn(), emitEvent: vi.fn() } };
}

function now() { return '2026-07-15T00:00:00.000Z'; }

async function waitFor(predicate: () => boolean | Promise<boolean>) {
  for (let index = 0; index < 100; index += 1) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error('Timed out waiting for worker state.');
}

class MemoryWorkerRepository implements IAgentWorkerRepository {
  private readonly workers = new Map<string, AgentWorkerRecord>();
  private readonly queues = new Map<string, Message[]>();
  private readonly notifications = new Map<string, AgentWorkerNotification[]>();
  async create(worker: AgentWorkerRecord) { this.workers.set(worker.id, structuredClone(worker)); }
  async get(id: string) { return structuredClone(this.workers.get(id) ?? null); }
  async list(scope: string) { return structuredClone([...this.workers.values()].filter((worker) => worker.parentScopeId === scope)); }
  async saveCheckpoint(checkpoint: AgentWorkerCheckpoint) { const worker = this.workers.get(checkpoint.id); if (!worker) throw new Error('missing'); this.workers.set(checkpoint.id, { ...worker, ...structuredClone(checkpoint) }); }
  async enqueueMessage(id: string, message: Message) { this.queues.set(id, [...(this.queues.get(id) ?? []), structuredClone(message)]); }
  async drainMessages(id: string) { const messages = this.queues.get(id) ?? []; this.queues.set(id, []); return structuredClone(messages); }
  async addNotification(notification: AgentWorkerNotification) { this.notifications.set(notification.parentScopeId, [...(this.notifications.get(notification.parentScopeId) ?? []), structuredClone(notification)]); }
  async drainNotifications(scope: string) { const values = this.notifications.get(scope) ?? []; this.notifications.set(scope, []); return structuredClone(values); }
  async recoverInterrupted() { return []; }
}
