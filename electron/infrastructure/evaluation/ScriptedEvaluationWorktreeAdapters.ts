import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentWorktreeSession } from '../../domain/entities/agentWorktree.js';
import type { IAgentWorktreeGateway } from '../../domain/ports/IAgentWorktreeGateway.js';
import type { IAgentWorktreeSessionRepository } from '../../domain/ports/IAgentWorktreeSessionRepository.js';

export class ScriptedEvaluationWorktreeGateway implements IAgentWorktreeGateway {
  private readonly outputRoot: string;
  private readonly baselines = new Map<string, Map<string, string>>();

  constructor(outputRoot: string) {
    this.outputRoot = path.resolve(outputRoot);
  }

  async create(scopeId: string, workspaceRoot: string, name: string): Promise<AgentWorktreeSession> {
    const worktreePath = path.join(this.outputRoot, `${scopeId}-${name.replaceAll('/', '-')}`);
    await fs.cp(workspaceRoot, worktreePath, { recursive: true, errorOnExist: true, force: false });
    this.baselines.set(worktreePath, await snapshot(worktreePath));
    return {
      scopeId,
      originalWorkspaceRoot: workspaceRoot,
      repositoryCommonDir: workspaceRoot,
      worktreePath,
      worktreeName: name,
      worktreeBranch: `agentstudio-worktree-${name.replaceAll('/', '-')}`,
      originalHeadCommit: 'scripted-evaluation-head',
      createdAt: new Date().toISOString(),
    };
  }

  async verify(session: AgentWorktreeSession) {
    const relative = path.relative(this.outputRoot, session.worktreePath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return false;
    return (await fs.stat(session.worktreePath).catch(() => null))?.isDirectory() === true;
  }

  async inspect(session: AgentWorktreeSession) {
    const baseline = this.baselines.get(session.worktreePath);
    if (!baseline || !(await this.verify(session))) return null;
    const current = await snapshot(session.worktreePath);
    const files = new Set([...baseline.keys(), ...current.keys()]);
    return { changedFiles: [...files].filter((file) => baseline.get(file) !== current.get(file)).length, commits: 0 };
  }

  async remove(session: AgentWorktreeSession) {
    if (!(await this.verify(session))) throw new Error('Evaluation worktree cannot be verified.');
    await fs.rm(session.worktreePath, { recursive: true, force: true });
    this.baselines.delete(session.worktreePath);
    return { branchRemoved: true };
  }
}

export class MemoryEvaluationWorktreeSessionRepository implements IAgentWorktreeSessionRepository {
  private readonly sessions = new Map<string, AgentWorktreeSession>();
  async load(scopeId: string) { return structuredClone(this.sessions.get(scopeId) ?? null); }
  async save(session: AgentWorktreeSession) { this.sessions.set(session.scopeId, structuredClone(session)); }
  async remove(scopeId: string) { this.sessions.delete(scopeId); }
}

async function snapshot(root: string) {
  const files = new Map<string, string>();
  await visit(root, '');
  return files;

  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const relative = path.posix.join(relativeDirectory, entry.name);
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute, relative);
      else if (entry.isFile()) files.set(relative, (await fs.readFile(absolute)).toString('base64'));
    }
  }
}
