import path from 'node:path';
import type { AgentProviderSettings } from '../../domain/entities/agent.js';
import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import type { IAgentWorkspaceScope } from '../../domain/ports/IAgentWorkspaceScope.js';
import type { IAgentWorkerEventSink } from '../../domain/ports/IAgentWorkerEventSink.js';
import type { AgentWorkerRunCallbacks, IAgentWorkerRunner } from '../../domain/ports/IAgentWorkerRunner.js';
import type { IAgentWorkerSessionProcessHost } from '../../domain/ports/IAgentWorkerSessionProcessHost.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { AgentToolCallRunner } from '../../application/services/AgentToolCallRunner.js';
import { toWorkerCheckpoint } from '../../application/services/agentWorkerCheckpoint.js';
import type { ManageAgentWorktrees } from '../../application/usecases/ManageAgentWorktrees.js';
import { AgentWorkerSessionEventSink } from './AgentWorkerSessionEventSink.js';
import { AgentWorkerWorkspaceLifecycle } from './AgentWorkerWorkspaceLifecycle.js';

type WorkerToolPlatform = IToolCatalog & IToolExecutor & IAgentWorkspaceScope;
type WorkerProcessContext = {
  toolPlatform: WorkerToolPlatform;
  toolRunner: Pick<AgentToolCallRunner, 'run'>;
  guidanceContext?: string;
  hooks: ILifecycleHookDispatcher;
};
type WorkerContextFactory = (worker: AgentWorkerRecord, workspaceRoot: string) => Promise<WorkerProcessContext>;

export class ProcessIsolatedAgentWorkerRuntime implements IAgentWorkerRunner {
  private readonly settings: AgentProviderSettings;
  private readonly workspace: AgentWorkerWorkspaceLifecycle;
  private readonly contextFactory: WorkerContextFactory;
  private readonly events: IAgentWorkerEventSink;
  private readonly host: IAgentWorkerSessionProcessHost;
  private readonly tracer: IAgentTracer;

  constructor(
    settings: AgentProviderSettings,
    worktrees: ManageAgentWorktrees,
    contextFactory: WorkerContextFactory,
    events: IAgentWorkerEventSink,
    host: IAgentWorkerSessionProcessHost,
    tracer: IAgentTracer,
  ) {
    this.settings = settings; this.workspace = new AgentWorkerWorkspaceLifecycle(worktrees);
    this.contextFactory = contextFactory; this.events = events; this.host = host; this.tracer = tracer;
  }

  async run(worker: AgentWorkerRecord, callbacks: AgentWorkerRunCallbacks, signal: AbortSignal) {
    const workspaceRoot = await this.workspace.prepare(worker);
    const context = await this.contextFactory(worker, workspaceRoot);
    const eventSink = new AgentWorkerSessionEventSink(worker, this.events);
    const currentRoot = () => context.toolPlatform.currentRoot(workspaceRoot);
    const result = await this.host.run({
      cwd: workspaceRoot,
      bootstrap: {
        worker,
        workspaceRoot,
        settings: { ...this.settings, model: worker.model || this.settings.model, permissionMode: worker.permissionMode },
        ...(context.guidanceContext ? { guidanceContext: context.guidanceContext } : {}),
      },
    }, {
      listTools: () => context.toolPlatform.list(currentRoot()),
      runTool: async (request) => {
        if (request.requestId !== worker.id) throw new Error('Worker tool request identity is invalid.');
        const tools = await context.toolPlatform.list(currentRoot());
        const toolName = request.toolCall.function?.name || '';
        return context.toolRunner.run({
          eventSink, permissionMode: worker.permissionMode, requestId: worker.id, step: request.step,
          toolCall: request.toolCall, toolDefinition: tools.find((tool) => tool.name === toolName),
          workspaceRoot: currentRoot(), traceContext: { traceId: worker.traceId, taskId: worker.id }, signal,
        });
      },
      checkpoint: async (checkpoint) => {
        if (checkpoint.id !== worker.id || checkpoint.traceId !== worker.traceId || path.resolve(checkpoint.workspaceRoot) !== path.resolve(worker.workspaceRoot)) {
          throw new Error('Worker checkpoint identity is invalid.');
        }
        await callbacks.checkpoint(toWorkerCheckpoint(worker, checkpoint, eventSink.result()));
      },
      drainMessages: callbacks.drainMessages,
      dispatchHook: async (event) => {
        await context.hooks.dispatch({ event, workspaceRoot: currentRoot(), requestId: worker.id, taskId: worker.id });
      },
      recordSpan: (span) => {
        if (span.traceId !== worker.traceId || span.taskId !== worker.id || span.kind !== 'model_call') {
          throw new Error('Worker model span identity is invalid.');
        }
        return this.tracer.recordSpan(span);
      },
      emit: (event) => {
        if (event.requestId !== worker.id) throw new Error('Worker event identity is invalid.');
        if (event.event === 'chunk') eventSink.emitChunk(worker.id, event.value || '');
        else if (event.event === 'done') eventSink.emitDone();
        else eventSink.emitError(worker.id, event.value || 'Agent worker process failed.');
      },
    }, signal);
    const worktree = await this.workspace.finalize(worker, result.status);
    return { ...result, result: eventSink.result(), ...worktree };
  }
}
