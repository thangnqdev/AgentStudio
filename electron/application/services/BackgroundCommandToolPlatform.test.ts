import { describe, expect, it, vi } from 'vitest';
import type { BackgroundCommandSnapshot } from '../../domain/entities/backgroundCommand.js';
import type { IBackgroundCommandSupervisor } from '../../domain/ports/IBackgroundCommandSupervisor.js';
import { ManageBackgroundCommands } from '../usecases/ManageBackgroundCommands.js';
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
    expect(tools.map((item) => item.name)).toEqual(['run_command', 'read_file', 'task_output', 'task_stop']);
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
  });
});

function createPlatform() {
  return createPlatformWithDependencies().platform;
}

function createPlatformWithDependencies() {
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
    ),
  };
}
