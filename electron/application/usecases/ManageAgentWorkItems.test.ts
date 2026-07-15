import { describe, expect, it, vi } from 'vitest';
import { createEmptyAgentWorkItemBoard, type AgentWorkItemBoard } from '../../domain/entities/agentWorkItem.js';
import type { IAgentWorkItemRepository } from '../../domain/ports/IAgentWorkItemRepository.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';
import { ManageAgentWorkItems } from './ManageAgentWorkItems.js';

class MemoryWorkItemRepository implements IAgentWorkItemRepository {
  boards = new Map<string, AgentWorkItemBoard>();
  async load(id: string) { return structuredClone(this.boards.get(id) ?? createEmptyAgentWorkItemBoard()); }
  async save(id: string, board: AgentWorkItemBoard) { this.boards.set(id, structuredClone(board)); }
  async delete(id: string) { this.boards.delete(id); }
}

const context = { workspaceRoot: '/workspace', requestId: 'request-1' };
const allowHooks: ILifecycleHookDispatcher = { dispatch: async () => ({ matchedHookIds: [], contexts: [], auditLabels: [] }) };

describe('ManageAgentWorkItems', () => {
  it('persists monotonic IDs, two-way dependencies, resolved blockers, and cascading deletion', async () => {
    const repository = new MemoryWorkItemRepository();
    const manager = new ManageAgentWorkItems(repository, allowHooks, () => '2026-07-15T00:00:00.000Z');
    await manager.create('session-1', { subject: 'Implement', description: 'Implement the feature' }, context);
    await manager.create('session-1', { subject: 'Verify', description: 'Run verification' }, context);
    await manager.update('session-1', { taskId: '2', addBlockedBy: ['1'] }, context);

    expect(await manager.get('session-1', '1')).toMatchObject({ blocks: ['2'] });
    expect(await manager.get('session-1', '2')).toMatchObject({ blockedBy: ['1'] });
    expect(await manager.list('session-1')).toEqual(expect.arrayContaining([expect.objectContaining({ id: '2', blockedBy: ['1'] })]));

    await manager.update('session-1', { taskId: '1', status: 'completed' }, context);
    expect(await manager.list('session-1')).toEqual(expect.arrayContaining([expect.objectContaining({ id: '2', blockedBy: [] })]));
    await manager.update('session-1', { taskId: '1', status: 'deleted' }, context);
    expect(await manager.get('session-1', '2')).toMatchObject({ blockedBy: [] });
    expect((await manager.create('session-1', { subject: 'Document', description: '' }, context)).id).toBe('3');
  });

  it('rolls back creation and completion when task lifecycle hooks block them', async () => {
    const repository = new MemoryWorkItemRepository();
    const dispatch = vi.fn<ILifecycleHookDispatcher['dispatch']>(async (input) => ({
      matchedHookIds: ['policy'], contexts: [], auditLabels: [],
      ...(input.event === 'TaskCreated' && input.matchValue === 'Forbidden'
        ? { taskBlockReason: 'Creation policy failed.' }
        : input.event === 'TaskCompleted' ? { taskBlockReason: 'Verification is missing.' } : {}),
    }));
    const manager = new ManageAgentWorkItems(repository, { dispatch }, () => '2026-07-15T00:00:00.000Z');

    await expect(manager.create('session-1', { subject: 'Forbidden', description: '' }, context)).rejects.toThrow('Creation policy failed');
    expect(await manager.list('session-1')).toEqual([]);
    const created = await manager.create('session-1', { subject: 'Allowed', description: '' }, context);
    await expect(manager.update('session-1', { taskId: created.id, status: 'completed' }, context)).rejects.toThrow('Verification is missing');
    expect(await manager.get('session-1', created.id)).toMatchObject({ status: 'pending' });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ taskId: '1', requestId: 'request-1' }));
  });

  it('rejects missing dependency targets and dependency cycles atomically', async () => {
    const manager = new ManageAgentWorkItems(new MemoryWorkItemRepository(), allowHooks);
    await manager.create('session-1', { subject: 'A', description: '' }, context);
    await manager.create('session-1', { subject: 'B', description: '' }, context);
    await expect(manager.update('session-1', { taskId: '1', addBlocks: ['99'] }, context)).rejects.toThrow('not found');
    await manager.update('session-1', { taskId: '1', addBlocks: ['2'] }, context);
    await expect(manager.update('session-1', { taskId: '2', addBlocks: ['1'] }, context)).rejects.toThrow('cycle');
    expect(await manager.get('session-1', '2')).toMatchObject({ blocks: [] });
  });

  it('auto-claims unowned in-progress work and reports assignment changes', async () => {
    const manager = new ManageAgentWorkItems(new MemoryWorkItemRepository(), allowHooks);
    const onOwnerChanged = vi.fn();
    await manager.create('team-list', { subject: 'Review', description: 'Review auth' }, context);
    await manager.update('team-list', { taskId: '1', status: 'in_progress' }, {
      ...context, actorName: 'reviewer', onOwnerChanged,
    });
    expect(await manager.get('team-list', '1')).toMatchObject({ status: 'in_progress', owner: 'reviewer' });
    expect(onOwnerChanged).toHaveBeenCalledWith(expect.objectContaining({ id: '1', owner: 'reviewer' }), undefined);
    await manager.clear('team-list');
    expect(await manager.list('team-list')).toEqual([]);
  });
});
