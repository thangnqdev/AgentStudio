import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import type { ManageAgentWorktrees } from '../../application/usecases/ManageAgentWorktrees.js';
import { isInsidePath } from '../security/resolveSafePath.js';

export class AgentWorkerWorkspaceLifecycle {
  private readonly worktrees: ManageAgentWorktrees;

  constructor(worktrees: ManageAgentWorktrees) { this.worktrees = worktrees; }

  async prepare(worker: AgentWorkerRecord) {
    if (worker.cwd) return resolveWorkerCwd(worker);
    await this.worktrees.restore(worker.id, worker.workspaceRoot);
    if (worker.isolation && !this.worktrees.get(worker.id)) {
      await this.worktrees.enter(worker.id, worker.workspaceRoot, worker.name || `agent-${worker.id.slice(0, 8)}`);
    }
    return this.worktrees.currentRoot(worker.id, worker.workspaceRoot);
  }

  async finalize(worker: AgentWorkerRecord, status: 'completed' | 'paused') {
    const session = this.worktrees.get(worker.id);
    if (!session || status !== 'completed') return session ? { worktreePath: session.worktreePath, worktreeBranch: session.worktreeBranch } : {};
    try {
      await this.worktrees.exit(worker.id, { action: 'remove', discardChanges: false });
      return {};
    } catch {
      const kept = await this.worktrees.exit(worker.id, { action: 'keep', discardChanges: false });
      return { worktreePath: kept.session.worktreePath, worktreeBranch: kept.session.worktreeBranch };
    }
  }
}

async function resolveWorkerCwd(worker: AgentWorkerRecord) {
  if (!worker.cwd || !path.isAbsolute(worker.cwd)) throw new Error('Agent cwd must be an absolute path.');
  const realCwd = await fs.realpath(worker.cwd);
  const stat = await fs.lstat(realCwd);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Agent cwd must resolve to a real directory.');
  const realWorkspace = await fs.realpath(worker.workspaceRoot);
  if (worker.permissionMode !== 'danger-full-access' && !isInsidePath(realCwd, realWorkspace)) {
    throw new Error('Agent cwd must stay inside the workspace unless danger-full-access is active.');
  }
  return realCwd;
}
