import type { AgentProviderSettings } from '../../domain/entities/agent.js';
import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import type { IAgentWorkspaceScope } from '../../domain/ports/IAgentWorkspaceScope.js';
import type { IAgentWorkerEventSink } from '../../domain/ports/IAgentWorkerEventSink.js';
import type { AgentWorkerRunCallbacks, IAgentWorkerRunner } from '../../domain/ports/IAgentWorkerRunner.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { RunAgentSession } from '../../application/usecases/RunAgentSession.js';
import type { ManageAgentWorktrees } from '../../application/usecases/ManageAgentWorktrees.js';
import { buildWorkerGuidance } from '../../application/services/agentWorkerGuidance.js';
import { toWorkerCheckpoint } from '../../application/services/agentWorkerCheckpoint.js';
import { AgentWorkerSessionEventSink } from './AgentWorkerSessionEventSink.js';
import { AgentWorkerWorkspaceLifecycle } from './AgentWorkerWorkspaceLifecycle.js';

type WorkerToolPlatform = IToolCatalog & IToolExecutor & IAgentWorkspaceScope;
type WorkerSessionFactory = (worker: AgentWorkerRecord, workspaceRoot: string) => Promise<{
  session: RunAgentSession;
  toolPlatform: WorkerToolPlatform;
  guidanceContext?: string;
}>;

export class AgentWorkerRuntime implements IAgentWorkerRunner {
  private readonly settings: AgentProviderSettings;
  private readonly workspace: AgentWorkerWorkspaceLifecycle;
  private readonly sessionFactory: WorkerSessionFactory;
  private readonly events: IAgentWorkerEventSink;

  constructor(settings: AgentProviderSettings, worktrees: ManageAgentWorktrees, sessionFactory: WorkerSessionFactory, events: IAgentWorkerEventSink) {
    this.settings = settings;
    this.workspace = new AgentWorkerWorkspaceLifecycle(worktrees);
    this.sessionFactory = sessionFactory;
    this.events = events;
  }

  async run(worker: AgentWorkerRecord, callbacks: AgentWorkerRunCallbacks, signal: AbortSignal) {
    const workspaceRoot = await this.workspace.prepare(worker);
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
    const worktree = await this.workspace.finalize(worker, result.status);
    return { ...result, result: eventSink.result(), ...worktree };
  }
}
