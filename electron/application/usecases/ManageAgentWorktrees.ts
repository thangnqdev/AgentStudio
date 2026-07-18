import type { AgentWorktreeSession, AgentWorktreeStatePayload } from '../../domain/entities/agentWorktree.js';
import type { IAgentWorktreeGateway } from '../../domain/ports/IAgentWorktreeGateway.js';
import type { IAgentWorktreeSessionRepository } from '../../domain/ports/IAgentWorktreeSessionRepository.js';
import type { ExitWorktreeInput } from '../services/agentWorktreeInput.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';

export class ManageAgentWorktrees {
  private readonly gateway: IAgentWorktreeGateway;
  private readonly repository: IAgentWorktreeSessionRepository;
  private readonly hooks?: ILifecycleHookDispatcher;
  private readonly sessions = new Map<string, AgentWorktreeSession>();
  private readonly restored = new Set<string>();
  private readonly restoreOperations = new Map<string, Promise<void>>();
  private readonly mutations = new Map<string, Promise<unknown>>();

  constructor(gateway: IAgentWorktreeGateway, repository: IAgentWorktreeSessionRepository, hooks?: ILifecycleHookDispatcher) {
    this.gateway = gateway;
    this.repository = repository;
    this.hooks = hooks;
  }

  async restore(scopeId: string, originalWorkspaceRoot: string) {
    if (this.restored.has(scopeId)) return;
    const existing = this.restoreOperations.get(scopeId);
    if (existing) return existing;
    const operation = this.restoreOne(scopeId, originalWorkspaceRoot)
      .then(() => { this.restored.add(scopeId); })
      .finally(() => { this.restoreOperations.delete(scopeId); });
    this.restoreOperations.set(scopeId, operation);
    return operation;
  }

  currentRoot(scopeId: string, fallbackRoot: string) {
    return this.sessions.get(scopeId)?.worktreePath ?? fallbackRoot;
  }

  get(scopeId: string) {
    const session = this.sessions.get(scopeId);
    return session ? structuredClone(session) : null;
  }

  state(scopeId: string): AgentWorktreeStatePayload {
    const session = this.sessions.get(scopeId);
    return session
      ? { active: true, path: session.worktreePath, branch: session.worktreeBranch }
      : { active: false };
  }

  async enter(scopeId: string, originalWorkspaceRoot: string, name: string) {
    return this.serialize(scopeId, () => this.enterOne(scopeId, originalWorkspaceRoot, name));
  }

  async exit(scopeId: string, input: ExitWorktreeInput) {
    return this.serialize(scopeId, () => this.exitOne(scopeId, input));
  }

  private async enterOne(scopeId: string, originalWorkspaceRoot: string, name: string) {
    await this.restore(scopeId, originalWorkspaceRoot);
    if (this.sessions.has(scopeId)) throw new Error('Already in a worktree session. Use ExitWorktree first.');
    const session = await this.gateway.create(scopeId, originalWorkspaceRoot, name);
    try {
      await this.repository.save(session);
    } catch (error) {
      await this.gateway.remove(session, true).catch(() => undefined);
      throw error;
    }
    this.sessions.set(scopeId, structuredClone(session));
    await this.dispatch('WorktreeCreate', scopeId, session.originalWorkspaceRoot, session.worktreeBranch);
    await this.dispatchCwd(scopeId, session.worktreePath);
    return structuredClone(session);
  }

  private async exitOne(scopeId: string, input: ExitWorktreeInput) {
    const session = this.sessions.get(scopeId);
    if (!session) throw new Error('No active EnterWorktree session exists for this chat. No filesystem changes were made.');
    const changes = await this.gateway.inspect(session);
    if (input.action === 'remove' && !input.discardChanges) assertSafeToRemove(session, changes);
    const removal = input.action === 'remove' ? await this.gateway.remove(session, input.discardChanges) : undefined;
    await this.repository.remove(scopeId);
    this.sessions.delete(scopeId);
    await this.dispatch('WorktreeRemove', scopeId, session.originalWorkspaceRoot, session.worktreeBranch);
    await this.dispatchCwd(scopeId, session.originalWorkspaceRoot);
    return { session: structuredClone(session), changes, removal };
  }

  private async dispatch(event: 'WorktreeCreate' | 'WorktreeRemove', scopeId: string, workspaceRoot: string, matchValue: string) {
    await this.hooks?.dispatch({ event, workspaceRoot, matchValue, requestId: scopeId, taskId: scopeId }).catch(() => undefined);
  }

  private async dispatchCwd(scopeId: string, workspaceRoot: string) {
    await this.hooks?.dispatch({
      event: 'CwdChanged', workspaceRoot, matchValue: workspaceRoot, requestId: scopeId, taskId: scopeId,
    }).catch(() => undefined);
  }

  private async serialize<T>(scopeId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.mutations.get(scopeId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.mutations.set(scopeId, current);
    try {
      return await current;
    } finally {
      if (this.mutations.get(scopeId) === current) this.mutations.delete(scopeId);
    }
  }

  private async restoreOne(scopeId: string, originalWorkspaceRoot: string) {
    const session = await this.repository.load(scopeId);
    if (!session) return;
    if (session.originalWorkspaceRoot !== originalWorkspaceRoot || !(await this.gateway.verify(session))) {
      await this.repository.remove(scopeId);
      return;
    }
    this.sessions.set(scopeId, structuredClone(session));
  }
}

function assertSafeToRemove(session: AgentWorktreeSession, changes: Awaited<ReturnType<IAgentWorktreeGateway['inspect']>>) {
  if (!changes) {
    throw new Error(`Could not verify worktree state at ${session.worktreePath}. Re-run with discard_changes=true only after explicit user confirmation, or keep it.`);
  }
  const parts: string[] = [];
  if (changes.changedFiles) parts.push(`${changes.changedFiles} uncommitted ${changes.changedFiles === 1 ? 'file' : 'files'}`);
  if (changes.commits) parts.push(`${changes.commits} unmerged ${changes.commits === 1 ? 'commit' : 'commits'}`);
  if (parts.length) {
    throw new Error(`Worktree has ${parts.join(' and ')}. Confirm permanent discard with the user, then re-run with discard_changes=true, or keep it.`);
  }
}
