import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { GitAgentWorktreeGateway } from './GitAgentWorktreeGateway.js';

const run = promisify(execFile);
const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))));

describe('GitAgentWorktreeGateway', () => {
  it('creates, verifies, inspects, and removes an isolated worktree with argument-array Git calls', async () => {
    const fixture = await createRepository();
    const gateway = new GitAgentWorktreeGateway(fixture.worktrees);
    const session = await gateway.create('chat-a', fixture.repository, 'user/feature');
    expect(session.worktreeBranch).toMatch(/^agentstudio-worktree-user\+feature-[a-f0-9]{10}$/);
    expect(session.worktreePath.startsWith(fixture.worktrees)).toBe(true);
    expect(await gateway.verify(session)).toBe(true);
    expect(await fs.readFile(path.join(session.worktreePath, 'README.md'), 'utf8')).toBe('base\n');

    await fs.writeFile(path.join(session.worktreePath, 'feature.txt'), 'isolated\n');
    expect(await gateway.inspect(session)).toEqual({ changedFiles: 1, commits: 0 });
    const removed = await gateway.remove(session, true);
    expect(removed.branchRemoved).toBe(true);
    await expect(fs.access(session.worktreePath)).rejects.toThrow();
    await expect(run('git', ['show-ref', '--verify', `refs/heads/${session.worktreeBranch}`], { cwd: fixture.repository })).rejects.toThrow();
  });

  it('resumes only the same chat scope and isolates equal names across chats', async () => {
    const fixture = await createRepository();
    const gateway = new GitAgentWorktreeGateway(fixture.worktrees);
    const first = await gateway.create('chat-a', fixture.repository, 'stable');
    const resumed = await gateway.create('chat-a', fixture.repository, 'stable');
    expect(resumed.worktreePath).toBe(first.worktreePath);
    expect(resumed.scopeId).toBe('chat-a');
    expect(await gateway.verify(resumed)).toBe(true);
    const otherChat = await gateway.create('chat-b', fixture.repository, 'stable');
    expect(otherChat.worktreePath).not.toBe(first.worktreePath);
    expect(otherChat.worktreeBranch).not.toBe(first.worktreeBranch);
    expect(await gateway.verify(otherChat)).toBe(true);
    await gateway.remove(resumed, true);
    await gateway.remove(otherChat, true);
  });

  it('refuses removal when persisted ownership metadata is tampered', async () => {
    const fixture = await createRepository();
    const gateway = new GitAgentWorktreeGateway(fixture.worktrees);
    const session = await gateway.create('chat-a', fixture.repository, 'safe');
    await expect(gateway.remove({ ...session, worktreeBranch: 'main' }, true)).rejects.toThrow('ownership');
    expect(await gateway.verify(session)).toBe(true);
    await gateway.remove(session, true);
  });
});

async function createRepository() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-git-worktree-'));
  roots.push(root);
  const repository = path.join(root, 'repo');
  const worktrees = path.join(root, 'managed-worktrees');
  await fs.mkdir(repository);
  await run('git', ['init', '-b', 'main'], { cwd: repository });
  await run('git', ['config', 'user.email', 'agentstudio@example.invalid'], { cwd: repository });
  await run('git', ['config', 'user.name', 'AgentStudio Test'], { cwd: repository });
  await fs.writeFile(path.join(repository, 'README.md'), 'base\n');
  await run('git', ['add', 'README.md'], { cwd: repository });
  await run('git', ['commit', '-m', 'initial'], { cwd: repository });
  return { repository, worktrees };
}
