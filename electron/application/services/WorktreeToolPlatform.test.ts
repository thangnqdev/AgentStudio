import { describe, expect, it } from 'vitest';
import type { AgentWorktreeSession } from '../../domain/entities/agentWorktree.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import { ManageAgentWorktrees } from '../usecases/ManageAgentWorktrees.js';
import { WorktreeToolPlatform } from './WorktreeToolPlatform.js';

const worktree: AgentWorktreeSession = {
  scopeId: 'chat-a', originalWorkspaceRoot: '/repo', repositoryCommonDir: '/repo/.git',
  worktreePath: '/private/worktrees/isolated', worktreeName: 'isolated',
  worktreeBranch: 'agentstudio-worktree-isolated', originalHeadCommit: 'abc', createdAt: '2026-01-01T00:00:00.000Z',
};

describe('WorktreeToolPlatform', () => {
  it('switches delegated tools to the isolated root and restores the original root', async () => {
    const roots: string[] = [];
    const states: boolean[] = [];
    const manager = new ManageAgentWorktrees(
      { create: async () => worktree, verify: async () => true, inspect: async () => ({ changedFiles: 0, commits: 0 }), remove: async () => ({ branchRemoved: true }) },
      { load: async () => null, save: async () => undefined, remove: async () => undefined },
    );
    const platform = new WorktreeToolPlatform(
      { list: async () => [] },
      { execute: async (_name, _args, root) => { roots.push(root); return { ok: true, output: root }; } },
      manager, eventSink(states), { scopeId: 'chat-a', requestId: 'request-a', originalWorkspaceRoot: '/repo' },
    );
    expect((await platform.list('/repo')).map((tool) => tool.name)).toEqual(['EnterWorktree', 'ExitWorktree']);
    await platform.execute('EnterWorktree', { name: 'isolated' }, '/repo', 'danger-full-access');
    expect((await platform.execute('read_file', { path: 'README.md' }, '/repo', 'danger-full-access')).output).toBe(worktree.worktreePath);
    await platform.execute('ExitWorktree', { action: 'keep' }, '/repo', 'danger-full-access');
    expect((await platform.execute('read_file', { path: 'README.md' }, '/repo', 'danger-full-access')).output).toBe('/repo');
    expect(roots).toEqual([worktree.worktreePath, '/repo']);
    expect(states).toEqual([true, false]);
  });
});

function eventSink(states: boolean[]): IAgentEventSink {
  return {
    emitChunk: () => undefined, emitAction: () => undefined, emitDone: () => undefined, emitError: () => undefined,
    emitWorktree: (_requestId, state) => { states.push(state.active); },
  };
}
