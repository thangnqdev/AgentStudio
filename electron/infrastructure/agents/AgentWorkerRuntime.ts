import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentProviderSettings } from '../../domain/entities/agent.js';
import type { AgentTaskCheckpoint } from '../../domain/entities/agentTask.js';
import type { AgentWorkerCheckpoint, AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import type { IAgentWorkspaceScope } from '../../domain/ports/IAgentWorkspaceScope.js';
import type { IAgentWorkerEventSink } from '../../domain/ports/IAgentWorkerEventSink.js';
import type { AgentWorkerRunCallbacks, IAgentWorkerRunner } from '../../domain/ports/IAgentWorkerRunner.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { RunAgentSession } from '../../application/usecases/RunAgentSession.js';
import type { ManageAgentWorktrees } from '../../application/usecases/ManageAgentWorktrees.js';
import { isInsidePath } from '../security/resolveSafePath.js';
import { AgentWorkerSessionEventSink } from './AgentWorkerSessionEventSink.js';

type WorkerToolPlatform = IToolCatalog & IToolExecutor & IAgentWorkspaceScope;
type WorkerSessionFactory = (worker: AgentWorkerRecord, workspaceRoot: string) => Promise<{
  session: RunAgentSession;
  toolPlatform: WorkerToolPlatform;
  guidanceContext?: string;
}>;

export class AgentWorkerRuntime implements IAgentWorkerRunner {
  private readonly settings: AgentProviderSettings;
  private readonly worktrees: ManageAgentWorktrees;
  private readonly sessionFactory: WorkerSessionFactory;
  private readonly events: IAgentWorkerEventSink;

  constructor(settings: AgentProviderSettings, worktrees: ManageAgentWorktrees, sessionFactory: WorkerSessionFactory, events: IAgentWorkerEventSink) {
    this.settings = settings;
    this.worktrees = worktrees;
    this.sessionFactory = sessionFactory;
    this.events = events;
  }

  async run(worker: AgentWorkerRecord, callbacks: AgentWorkerRunCallbacks, signal: AbortSignal) {
    const workspaceRoot = await this.prepareWorkspace(worker);
    const { session, toolPlatform, guidanceContext } = await this.sessionFactory(worker, workspaceRoot);
    const eventSink = new AgentWorkerSessionEventSink(worker, this.events);
    const result = await session.execute(
      { requestId: worker.id, messages: worker.messages }, eventSink,
      { ...this.settings, model: worker.model || this.settings.model, permissionMode: worker.permissionMode },
      workspaceRoot, undefined, buildWorkerGuidance(worker, guidanceContext), signal,
      {
        id: worker.id, traceId: worker.traceId, workspaceRoot: worker.workspaceRoot,
        completedSteps: worker.completedSteps, messages: worker.messages, conversation: worker.conversation,
        onCheckpoint: (checkpoint) => callbacks.checkpoint(toWorkerCheckpoint(worker, checkpoint, eventSink.result())),
        drainMessages: callbacks.drainMessages,
      },
      toolPlatform,
    );
    if (!result) throw new Error('Agent worker ended without a runtime result.');
    const worktree = await this.finalizeWorktree(worker, result.status);
    return { ...result, result: eventSink.result(), ...worktree };
  }

  private async prepareWorkspace(worker: AgentWorkerRecord) {
    if (worker.cwd) return resolveWorkerCwd(worker);
    await this.worktrees.restore(worker.id, worker.workspaceRoot);
    if (worker.isolation && !this.worktrees.get(worker.id)) {
      await this.worktrees.enter(worker.id, worker.workspaceRoot, worker.name || `agent-${worker.id.slice(0, 8)}`);
    }
    return this.worktrees.currentRoot(worker.id, worker.workspaceRoot);
  }

  private async finalizeWorktree(worker: AgentWorkerRecord, status: 'completed' | 'paused') {
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

function toWorkerCheckpoint(worker: AgentWorkerRecord, checkpoint: AgentTaskCheckpoint, result: string): AgentWorkerCheckpoint {
  return {
    id: worker.id, status: checkpoint.status, updatedAt: new Date().toISOString(), completedSteps: checkpoint.completedSteps,
    messages: checkpoint.messages, conversation: checkpoint.conversation, ...(result ? { result } : {}),
  };
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

function buildWorkerGuidance(worker: AgentWorkerRecord, profile?: string) {
  return [
    `You are agent ${worker.name || worker.id} working for a parent coding agent.`,
    `Delegated task: ${worker.description}. Complete it autonomously and return concrete evidence.`,
    'Use SendMessage when the parent sends new instructions. Nested Agent calls must remain synchronous.',
    profile || '',
  ].join('\n');
}
