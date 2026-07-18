import { describe, expect, it, vi } from 'vitest';
import type { BackgroundCommandSnapshot } from '../../domain/entities/backgroundCommand.js';
import type { IBackgroundCommandSupervisor } from '../../domain/ports/IBackgroundCommandSupervisor.js';
import { ManageBackgroundCommands } from './ManageBackgroundCommands.js';

const runningTask: BackgroundCommandSnapshot = {
  id: 'bg-1', scopeId: 'thread-1', command: 'npm test', description: 'Run tests',
  workspaceRoot: '/workspace', permissionMode: 'workspace-write', status: 'running',
  startedAt: '2026-01-01T00:00:00.000Z', exitCode: null, outputBytes: 0, outputTruncated: false,
};

describe('ManageBackgroundCommands', () => {
  it('forwards validated context without coupling the use case to process APIs', async () => {
    const supervisor = fakeSupervisor();
    const manager = new ManageBackgroundCommands(supervisor);
    await manager.start('thread-1', { command: 'npm test', description: 'Run tests', timeoutMs: 5_000 }, {
      workspaceRoot: '/workspace', permissionMode: 'workspace-write',
    });
    expect(supervisor.start).toHaveBeenCalledWith({
      scopeId: 'thread-1', command: 'npm test', description: 'Run tests', timeoutMs: 5_000,
      workspaceRoot: '/workspace', permissionMode: 'workspace-write',
    });
  });

  it('forwards an explicitly selected native shell', async () => {
    const supervisor = fakeSupervisor();
    const manager = new ManageBackgroundCommands(supervisor);
    await manager.start('thread-1', {
      command: 'Get-ChildItem', description: 'List files', timeoutMs: 5_000, shell: 'powershell',
    }, { workspaceRoot: '/workspace', permissionMode: 'danger-full-access' });
    expect(supervisor.start).toHaveBeenCalledWith(expect.objectContaining({ shell: 'powershell' }));
  });

  it('does not expose a task from another scope and rejects stopping terminal work', async () => {
    const supervisor = fakeSupervisor();
    vi.mocked(supervisor.output).mockResolvedValue(null);
    const manager = new ManageBackgroundCommands(supervisor);
    await expect(manager.output('other-thread', { taskId: 'bg-1', block: false, timeoutMs: 0 })).rejects.toThrow('No background command');

    vi.mocked(supervisor.stop).mockResolvedValue({ ...runningTask, status: 'completed' });
    await expect(manager.stop('thread-1', 'bg-1')).rejects.toThrow('is not running');
  });
});

function fakeSupervisor(): IBackgroundCommandSupervisor {
  return {
    start: vi.fn(async () => runningTask),
    output: vi.fn(async () => ({ retrievalStatus: 'not_ready' as const, task: runningTask, output: '' })),
    stop: vi.fn(async () => ({ ...runningTask, status: 'stopped' as const })),
  };
}
