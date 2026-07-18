import { describe, expect, it, vi } from 'vitest';
import type { BackgroundCommandSnapshot } from '../../domain/entities/backgroundCommand.js';
import type { IBackgroundCommandSupervisor } from '../../domain/ports/IBackgroundCommandSupervisor.js';
import { ManageBackgroundCommands } from '../usecases/ManageBackgroundCommands.js';
import { ManageAgentWorkers } from '../usecases/ManageAgentWorkers.js';
import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import { BackgroundCommandToolPlatform } from './BackgroundCommandToolPlatform.js';

const task: BackgroundCommandSnapshot = {
  id: 'bg-1', scopeId: 'thread-1', command: 'npm test', description: 'Run tests',
  workspaceRoot: '/workspace', permissionMode: 'danger-full-access', status: 'running',
  startedAt: '2026-01-01T00:00:00.000Z', exitCode: null, outputBytes: 0, outputTruncated: false,
};

describe('BackgroundCommandToolPlatform', () => {
  it('extends run_command and exposes output/stop tools without duplicating base tools', async () => {
    const platform = createPlatform();
    const tools = await platform.list('/workspace');
    expect(tools.map((item) => item.name)).toEqual([
      'run_command', 'read_file', 'TaskOutput', 'TaskStop', 'task_output', 'task_stop',
      'AgentOutputTool', 'BashOutputTool', 'KillShell',
    ]);
    const run = tools.find((item) => item.name === 'run_command');
    expect(JSON.stringify(run?.parameters)).toContain('runInBackground');
  });

  it('starts a background command and returns a durable task ID', async () => {
    const { platform, supervisor, baseExecutor } = createPlatformWithDependencies();
    const result = await platform.execute('run_command', {
      command: 'npm test', description: 'Run tests', runInBackground: true, timeoutMs: 5_000,
    }, '/workspace', 'danger-full-access');
    expect(result).toMatchObject({ ok: true, output: expect.stringContaining('<task_id>bg-1</task_id>') });
    expect(supervisor.start).toHaveBeenCalledOnce();
    expect(baseExecutor.execute).not.toHaveBeenCalled();
  });

  it('delegates foreground commands and formats background output', async () => {
    const { platform, baseExecutor } = createPlatformWithDependencies();
    await platform.execute('run_command', { command: 'npm test' }, '/workspace', 'danger-full-access');
    expect(baseExecutor.execute).toHaveBeenCalledOnce();

    const result = await platform.execute('task_output', { taskId: 'bg-1', block: false }, '/workspace', 'read-only');
    expect(result.output).toContain('<retrieval_status>not_ready</retrieval_status>');
    expect(result.output).toContain('<task_id>bg-1</task_id>');
    const exact = await platform.execute('TaskOutput', { task_id: 'bg-1', block: false, timeout: 5 }, '/workspace', 'read-only');
    expect(exact.output).toContain('<task_type>local_bash</task_type>');
    const legacy = await platform.execute('BashOutputTool', { task_id: 'bg-1', block: false }, '/workspace', 'read-only');
    expect(legacy.output).toContain('<task_id>bg-1</task_id>');
  });

  it('uses the exact TaskOutput and TaskStop namespace for background agents', async () => {
    let worker: AgentWorkerRecord = {
      id: 'agent-1', traceId: 'trace-1', parentScopeId: 'thread-1', description: 'Review code', prompt: 'Review',
      workspaceRoot: '/workspace', permissionMode: 'workspace-write', depth: 1, background: true,
      status: 'completed', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:01.000Z',
      completedSteps: 1, messages: [], conversation: [], result: 'Review complete.',
    };
    const repository = {
      create: async () => undefined, get: async (id: string) => id === worker.id ? structuredClone(worker) : null,
      list: async () => [structuredClone(worker)], saveCheckpoint: async () => undefined,
      enqueueMessage: async () => undefined, drainMessages: async () => [], addNotification: async () => undefined,
      drainNotifications: async () => [], recoverInterrupted: async () => [],
    };
    const workers = new ManageAgentWorkers(repository, {
      newSpanId: () => 'span', startTrace: async () => undefined, updateTrace: async () => undefined,
      recordSpan: async () => 'span',
    });
    const dependencies = createPlatformWithDependencies(workers);
    const output = await dependencies.platform.execute('TaskOutput', {
      task_id: worker.id, block: false, timeout: 1,
    }, '/workspace', 'read-only');
    expect(output.output).toContain('<task_type>local_agent</task_type>');
    expect(output.output).toContain('Review complete.');

    worker = { ...worker, status: 'running' };
    const stopped = await dependencies.platform.execute('TaskStop', { task_id: worker.id }, '/workspace', 'workspace-write');
    expect(stopped.output).toContain('"task_type":"local_agent"');
  });
});

function createPlatform() {
  return createPlatformWithDependencies().platform;
}

function createPlatformWithDependencies(workers?: ManageAgentWorkers) {
  const supervisor: IBackgroundCommandSupervisor = {
    start: vi.fn(async () => task),
    output: vi.fn(async () => ({ retrievalStatus: 'not_ready' as const, task, output: 'running' })),
    stop: vi.fn(async () => ({ ...task, status: 'stopped' as const })),
  };
  const baseCatalog = {
    list: async () => [
      { name: 'run_command', description: 'Run', risk: 'execute' as const, parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] } },
      { name: 'read_file', description: 'Read', risk: 'read' as const, parameters: { type: 'object' } },
      { name: 'task_output', description: 'stale', risk: 'read' as const, parameters: {} },
    ],
  };
  const baseExecutor = { execute: vi.fn(async () => ({ ok: true, output: 'foreground' })) };
  return {
    supervisor,
    baseExecutor,
    platform: new BackgroundCommandToolPlatform(
      baseCatalog,
      baseExecutor,
      new ManageBackgroundCommands(supervisor),
      'thread-1',
      workers,
    ),
  };
}
