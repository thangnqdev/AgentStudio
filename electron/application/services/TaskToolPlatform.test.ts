import { describe, expect, it, vi } from 'vitest';
import { createEmptyAgentWorkItemBoard, type AgentWorkItemBoard } from '../../domain/entities/agentWorkItem.js';
import type { IAgentWorkItemRepository } from '../../domain/ports/IAgentWorkItemRepository.js';
import { ManageAgentWorkItems } from '../usecases/ManageAgentWorkItems.js';
import { TaskToolPlatform } from './TaskToolPlatform.js';

class MemoryRepository implements IAgentWorkItemRepository {
  boards = new Map<string, AgentWorkItemBoard>();
  async load(id: string) { return structuredClone(this.boards.get(id) ?? createEmptyAgentWorkItemBoard()); }
  async save(id: string, board: AgentWorkItemBoard) { this.boards.set(id, structuredClone(board)); }
  async delete(id: string) { this.boards.delete(id); }
}

describe('TaskToolPlatform', () => {
  it('adds exact and legacy task tools and preserves them across a resumed session', async () => {
    const executeBase = vi.fn(async () => ({ ok: true, output: 'base' }));
    const base = { list: async () => [{ name: 'read_file', description: '', risk: 'read' as const, parameters: {} }] };
    const manager = new ManageAgentWorkItems(new MemoryRepository());
    const first = new TaskToolPlatform(base, { execute: executeBase }, manager, { taskListId: 'agent-session-1', requestId: 'request-1' });

    expect((await first.list('/workspace')).map((tool) => tool.name)).toEqual([
      'read_file', 'TaskCreate', 'task_create', 'TaskGet', 'task_get', 'TaskList', 'task_list', 'TaskUpdate', 'task_update',
    ]);
    await expect(first.execute('TaskCreate', { subject: 'Implement', description: 'Build it' }, '/workspace', 'read-only'))
      .resolves.toEqual({ ok: true, output: 'Task #1 created successfully: Implement' });
    await expect(first.execute('task_update', { taskId: '1', status: 'in_progress' }, '/workspace', 'read-only'))
      .resolves.toMatchObject({ ok: true, output: expect.stringContaining('status') });

    const resumed = new TaskToolPlatform(base, { execute: executeBase }, manager, { taskListId: 'agent-session-1', requestId: 'request-2' });
    await expect(resumed.execute('task_get', { taskId: '1' }, '/workspace', 'read-only'))
      .resolves.toMatchObject({ ok: true, output: expect.stringContaining('Status: in_progress') });
    const separate = new TaskToolPlatform(base, { execute: executeBase }, manager, { taskListId: 'agent-session-2' });
    await expect(separate.execute('task_list', {}, '/workspace', 'read-only')).resolves.toEqual({ ok: true, output: 'No tasks found.' });
  });

  it('rejects strict-input violations and delegates unrelated tools', async () => {
    const executeBase = vi.fn(async () => ({ ok: true, output: 'delegated' }));
    const platform = new TaskToolPlatform(
      { list: async () => [] },
      { execute: executeBase },
      new ManageAgentWorkItems(new MemoryRepository()),
      { taskListId: 'session' },
    );
    await expect(platform.execute('task_create', { subject: 'A', description: '', surprise: true }, '/workspace', 'danger-full-access'))
      .resolves.toMatchObject({ ok: false, output: 'Unsupported task field: surprise.' });
    await expect(platform.execute('task_list', { taskId: '1' }, '/workspace', 'danger-full-access'))
      .resolves.toMatchObject({ ok: false, output: 'Unsupported task field: taskId.' });
    await expect(platform.execute('read_file', { path: 'README.md' }, '/workspace', 'read-only'))
      .resolves.toEqual({ ok: true, output: 'delegated' });
    expect(executeBase).toHaveBeenCalledOnce();
  });

  it('resolves a team task list dynamically and auto-claims for the current actor', async () => {
    const manager = new ManageAgentWorkItems(new MemoryRepository());
    const assigned = vi.fn();
    const platform = new TaskToolPlatform(
      { list: async () => [] }, { execute: async () => ({ ok: true, output: '' }) }, manager,
      { taskListId: async () => 'shared-team-list', actorName: 'tester', onOwnerChanged: assigned },
    );
    await platform.execute('task_create', { subject: 'Test', description: 'Run tests' }, '/workspace', 'workspace-write');
    await platform.execute('task_update', { taskId: '1', status: 'in_progress' }, '/workspace', 'workspace-write');
    expect(await manager.get('shared-team-list', '1')).toMatchObject({ owner: 'tester' });
    expect(assigned).toHaveBeenCalledOnce();
  });

  it('returns a bounded tool error when dynamic task-list resolution fails', async () => {
    const platform = new TaskToolPlatform(
      { list: async () => [] }, { execute: async () => ({ ok: true, output: '' }) },
      new ManageAgentWorkItems(new MemoryRepository()),
      { taskListId: async () => { throw new Error('Team task list is unavailable.'); } },
    );
    await expect(platform.execute('task_list', {}, '/workspace', 'workspace-write'))
      .resolves.toEqual({ ok: false, output: 'Team task list is unavailable.' });
  });
});
