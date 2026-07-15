import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentWorktreeSession } from '../../domain/entities/agentWorktree.js';
import { PrivateAgentWorktreeSessionRepository } from './PrivateAgentWorktreeSessionRepository.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

describe('PrivateAgentWorktreeSessionRepository', () => {
  it('round-trips owner-only state under a hashed scope filename', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-worktree-state-'));
    roots.push(root);
    const repository = new PrivateAgentWorktreeSessionRepository(path.join(root, 'state'));
    const session = fixture();
    await repository.save(session);
    expect(await repository.load(session.scopeId)).toEqual(session);
    const files = await fs.readdir(path.join(root, 'state'));
    expect(files).toEqual([expect.stringMatching(/^[a-f0-9]{64}\.json$/)]);
    if (process.platform !== 'win32') expect((await fs.stat(path.join(root, 'state', files[0]))).mode & 0o777).toBe(0o600);
    await repository.remove(session.scopeId);
    expect(await repository.load(session.scopeId)).toBeNull();
  });

  it('rejects a symlinked state directory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-worktree-state-link-'));
    roots.push(root);
    const target = path.join(root, 'target');
    const link = path.join(root, 'link');
    await fs.mkdir(target);
    await fs.symlink(target, link, 'dir');
    await expect(new PrivateAgentWorktreeSessionRepository(link).save(fixture())).rejects.toThrow('unsafe');
  });
});

function fixture(): AgentWorktreeSession {
  return {
    scopeId: 'chat-a', originalWorkspaceRoot: '/repo', repositoryCommonDir: '/repo/.git',
    worktreePath: '/private/worktrees/feature', worktreeName: 'feature',
    worktreeBranch: 'agentstudio-worktree-feature', originalHeadCommit: 'abc123', createdAt: '2026-01-01T00:00:00.000Z',
  };
}
