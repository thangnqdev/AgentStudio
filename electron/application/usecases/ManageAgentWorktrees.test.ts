import { describe, expect, it, vi } from 'vitest';
import type { AgentWorktreeSession } from '../../domain/entities/agentWorktree.js';
import { ManageAgentWorktrees } from './ManageAgentWorktrees.js';

const session: AgentWorktreeSession = {
  scopeId: 'chat-a', originalWorkspaceRoot: '/repo', repositoryCommonDir: '/repo/.git',
  worktreePath: '/private/worktrees/feature', worktreeName: 'feature',
  worktreeBranch: 'agentstudio-worktree-feature', originalHeadCommit: 'abc123', createdAt: '2026-01-01T00:00:00.000Z',
};

describe('ManageAgentWorktrees', () => {
  it('persists, scopes, and keeps a worktree without deleting it', async () => {
    const save = vi.fn(async () => undefined);
    const removeState = vi.fn(async () => undefined);
    const removeWorktree = vi.fn(async () => ({ branchRemoved: true }));
    const manager = new ManageAgentWorktrees(
      { create: async () => session, verify: async () => true, inspect: async () => ({ changedFiles: 1, commits: 0 }), remove: removeWorktree },
      { load: async () => null, save, remove: removeState },
    );
    await manager.enter('chat-a', '/repo', 'feature');
    expect(manager.currentRoot('chat-a', '/repo')).toBe(session.worktreePath);
    await manager.exit('chat-a', { action: 'keep', discardChanges: false });
    expect(removeWorktree).not.toHaveBeenCalled();
    expect(removeState).toHaveBeenCalledWith('chat-a');
    expect(manager.currentRoot('chat-a', '/repo')).toBe('/repo');
  });

  it('refuses unknown or dirty removal unless discard is explicit', async () => {
    const remove = vi.fn(async () => ({ branchRemoved: true }));
    const manager = new ManageAgentWorktrees(
      { create: async () => session, verify: async () => true, inspect: async () => ({ changedFiles: 2, commits: 1 }), remove },
      { load: async () => null, save: async () => undefined, remove: async () => undefined },
    );
    await manager.enter('chat-a', '/repo', 'feature');
    await expect(manager.exit('chat-a', { action: 'remove', discardChanges: false })).rejects.toThrow('2 uncommitted files');
    await manager.exit('chat-a', { action: 'remove', discardChanges: true });
    expect(remove).toHaveBeenCalledWith(session, true);
  });

  it('restores only a verified session for the same original workspace', async () => {
    const removeState = vi.fn(async () => undefined);
    const manager = new ManageAgentWorktrees(
      { create: async () => session, verify: async () => false, inspect: async () => null, remove: async () => ({ branchRemoved: true }) },
      { load: async () => session, save: async () => undefined, remove: removeState },
    );
    await manager.restore('chat-a', '/repo');
    expect(manager.get('chat-a')).toBeNull();
    expect(removeState).toHaveBeenCalledWith('chat-a');
  });

  it('serializes concurrent entry so one chat cannot acquire the same worktree twice', async () => {
    let releaseCreate: (() => void) | undefined;
    const create = vi.fn(() => new Promise<AgentWorktreeSession>((resolve) => {
      releaseCreate = () => resolve(session);
    }));
    const manager = new ManageAgentWorktrees(
      { create, verify: async () => true, inspect: async () => ({ changedFiles: 0, commits: 0 }), remove: async () => ({ branchRemoved: true }) },
      { load: async () => null, save: async () => undefined, remove: async () => undefined },
    );
    const first = manager.enter('chat-a', '/repo', 'feature');
    const second = manager.enter('chat-a', '/repo', 'feature');
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    releaseCreate?.();
    await expect(first).resolves.toEqual(session);
    await expect(second).rejects.toThrow('Already in a worktree');
    expect(create).toHaveBeenCalledTimes(1);
  });
});
