import type { AgentInteractionResponse } from '../../domain/entities/agentInteraction.js';
import type { RuntimeOptimizationConfig } from '../../domain/entities/optimizer.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import { AgentWorkerToolPlatform } from '../../application/services/AgentWorkerToolPlatform.js';
import { BackgroundCommandToolPlatform } from '../../application/services/BackgroundCommandToolPlatform.js';
import { InteractiveToolPlatform } from '../../application/services/InteractiveToolPlatform.js';
import { PlanAwareToolPermissionPolicy } from '../../application/services/PlanAwareToolPermissionPolicy.js';
import { TaskToolPlatform } from '../../application/services/TaskToolPlatform.js';
import { ToolPermissionPolicy } from '../../application/services/ToolPermissionPolicy.js';
import { WorktreeToolPlatform } from '../../application/services/WorktreeToolPlatform.js';
import { ManageAgentPlanMode } from '../../application/usecases/ManageAgentPlanMode.js';
import { ManageAgentWorkers } from '../../application/usecases/ManageAgentWorkers.js';
import { ManageAgentWorkItems } from '../../application/usecases/ManageAgentWorkItems.js';
import { ManageAgentWorktrees } from '../../application/usecases/ManageAgentWorktrees.js';
import { ManageBackgroundCommands } from '../../application/usecases/ManageBackgroundCommands.js';
import { AgentToolExecutor } from '../tools/AgentToolExecutor.js';
import { AttachmentMessageFormatter } from '../ai/AttachmentMessageFormatter.js';
import { PrivateAgentPlanRepository } from '../plans/PrivateAgentPlanRepository.js';
import { PrivateAgentWorkerRepository } from '../agents/PrivateAgentWorkerRepository.js';
import { createAgentWorkerExecution } from '../agents/createAgentWorkerExecution.js';
import { BackgroundCommandProcessSupervisor } from '../tasks/BackgroundCommandProcessSupervisor.js';
import { JsonAgentWorkItemRepository } from '../tasks/JsonAgentWorkItemRepository.js';
import { MemoryEvaluationWorktreeSessionRepository, ScriptedEvaluationWorktreeGateway } from './ScriptedEvaluationWorktreeAdapters.js';

type EvaluationRuntimeInput = {
  workspaceRoot: string;
  taskId: string;
  config: Readonly<RuntimeOptimizationConfig>;
  workerProvider: IAiProvider;
  tracer: IAgentTracer;
  interactionResponses: AgentInteractionResponse[];
  roots: { workItems: string; background: string; plans: string; worktrees: string; workers: string };
};

export function createEvaluationToolRuntime(input: EvaluationRuntimeInput) {
  const base = new AgentToolExecutor({ provider: 'disabled' }, undefined, undefined, undefined, input.config.timeoutMs);
  const workItems = new ManageAgentWorkItems(new JsonAgentWorkItemRepository({ directory: input.roots.workItems }));
  const backgroundSupervisor = new BackgroundCommandProcessSupervisor(input.roots.background, () => 'bg-runtime-eval');
  const backgroundCommands = new ManageBackgroundCommands(backgroundSupervisor);
  const planManager = new ManageAgentPlanMode(new PrivateAgentPlanRepository(input.roots.plans));
  const worktrees = new ManageAgentWorktrees(
    new ScriptedEvaluationWorktreeGateway(input.roots.worktrees), new MemoryEvaluationWorktreeSessionRepository(),
  );
  const policy = new ToolPermissionPolicy([]);
  const workers = new ManageAgentWorkers(new PrivateAgentWorkerRepository(input.roots.workers), input.tracer);
  const hooks = { dispatch: async () => ({ matchedHookIds: [], contexts: [], auditLabels: [] }) };
  const workerExecution = createAgentWorkerExecution({
    provider: input.workerProvider,
    settings: {
      baseUrl: 'scripted://worker-evaluation', apiKey: '', model: input.config.modelChoice ?? 'scripted-worker',
      permissionMode: 'danger-full-access', retryCount: input.config.retryCount, requestTimeoutMs: input.config.timeoutMs,
      contextWindow: 16_384, contextBudgetTokens: input.config.contextBudgetTokens,
    },
    baseCatalog: base, baseExecutor: base, workers, workItems, backgroundCommands, worktrees,
    profiles: { load: async () => { throw new Error('Evaluation agent profile is unavailable.'); } },
    formatter: new AttachmentMessageFormatter(), approval: { requestApproval: async () => true },
    audit: { record: async () => undefined }, tracer: input.tracer, policy, hooks, events: NOOP_WORKER_EVENTS,
  });
  const agentPlatform = new AgentWorkerToolPlatform(base, base, workers, workerExecution, { parentScopeId: input.taskId, depth: 0 });
  const taskPlatform = new TaskToolPlatform(agentPlatform, agentPlatform, workItems, { taskListId: input.taskId, requestId: input.taskId });
  const backgroundPlatform = new BackgroundCommandToolPlatform(taskPlatform, taskPlatform, backgroundCommands, input.taskId);
  const interactionGateway = new ScriptedInteractionGateway(input.interactionResponses);
  const interactivePlatform = new InteractiveToolPlatform(
    backgroundPlatform, backgroundPlatform, planManager, interactionGateway, NOOP_EVENT_SINK,
    { scopeId: input.taskId, requestId: input.taskId }, () => `interaction-runtime-${input.interactionResponses.length}`,
  );
  const platform = new WorktreeToolPlatform(
    interactivePlatform, interactivePlatform, worktrees, NOOP_EVENT_SINK,
    { scopeId: input.taskId, requestId: input.taskId, originalWorkspaceRoot: input.workspaceRoot },
  );
  return {
    platform,
    permissionPolicy: new PlanAwareToolPermissionPolicy(policy, planManager, input.taskId),
    workers,
    backgroundSupervisor,
  };
}

class ScriptedInteractionGateway {
  private readonly responses: AgentInteractionResponse[];
  constructor(responses: AgentInteractionResponse[]) { this.responses = responses; }
  async waitForResponse() {
    const response = this.responses.shift();
    if (!response) throw new Error('Scripted interaction response is missing.');
    return structuredClone(response);
  }
}

const NOOP_WORKER_EVENTS = { emitWorker: () => undefined, emitEvent: () => undefined };
const NOOP_EVENT_SINK: IAgentEventSink = {
  emitChunk: () => undefined, emitAction: () => undefined, emitDone: () => undefined, emitError: () => undefined, emitInteraction: () => undefined,
};
