import type { AgentInteractionResponse } from '../../domain/entities/agentInteraction.js';
import type { RuntimeOptimizationConfig } from '../../domain/entities/optimizer.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import { AgentWorkerToolPlatform } from '../../application/services/AgentWorkerToolPlatform.js';
import { AgentTeamToolPlatform } from '../../application/services/AgentTeamToolPlatform.js';
import { BackgroundCommandToolPlatform } from '../../application/services/BackgroundCommandToolPlatform.js';
import { InteractiveToolPlatform } from '../../application/services/InteractiveToolPlatform.js';
import { PlanAwareToolPermissionPolicy } from '../../application/services/PlanAwareToolPermissionPolicy.js';
import { TaskToolPlatform } from '../../application/services/TaskToolPlatform.js';
import { ToolPermissionPolicy } from '../../application/services/ToolPermissionPolicy.js';
import { WorktreeToolPlatform } from '../../application/services/WorktreeToolPlatform.js';
import { ToolSearchPlatform } from '../../application/services/ToolSearchPlatform.js';
import { CompatibilityToolPlatform } from '../../application/services/CompatibilityToolPlatform.js';
import { ManageAgentPlanMode } from '../../application/usecases/ManageAgentPlanMode.js';
import { ManageAgentWorkers } from '../../application/usecases/ManageAgentWorkers.js';
import { ManageAgentTeams } from '../../application/usecases/ManageAgentTeams.js';
import { ManageAgentWorkItems } from '../../application/usecases/ManageAgentWorkItems.js';
import { ManageAgentWorktrees } from '../../application/usecases/ManageAgentWorktrees.js';
import { ManageBackgroundCommands } from '../../application/usecases/ManageBackgroundCommands.js';
import { AgentToolExecutor } from '../tools/AgentToolExecutor.js';
import { AttachmentMessageFormatter } from '../ai/AttachmentMessageFormatter.js';
import { PrivateAgentPlanRepository } from '../plans/PrivateAgentPlanRepository.js';
import { PrivateAgentWorkerRepository } from '../agents/PrivateAgentWorkerRepository.js';
import { PrivateAgentTeamRepository } from '../agents/PrivateAgentTeamRepository.js';
import { createAgentWorkerExecution } from '../agents/createAgentWorkerExecution.js';
import { BackgroundCommandProcessSupervisor } from '../tasks/BackgroundCommandProcessSupervisor.js';
import type { BackgroundCommandProcessHost } from '../tasks/BackgroundCommandProcessHost.js';
import { JsonAgentWorkItemRepository } from '../tasks/JsonAgentWorkItemRepository.js';
import { MemoryEvaluationWorktreeSessionRepository, ScriptedEvaluationWorktreeGateway } from './ScriptedEvaluationWorktreeAdapters.js';
import { ScriptedEvaluationWebPageFetcher } from './ScriptedEvaluationWebPageFetcher.js';
import { WebFetchToolPlatform } from '../../application/services/WebFetchToolPlatform.js';
import { WebFetchPermissionPolicy } from '../../application/services/WebFetchPermissionPolicy.js';
import { FetchWebContent } from '../../application/usecases/FetchWebContent.js';
import type { RuntimeEvaluationWebPage } from '../../domain/entities/agentEvaluation.js';
import { createNotebookToolPlatform } from '../notebooks/createNotebookToolPlatform.js';

type EvaluationRuntimeInput = {
  workspaceRoot: string;
  taskId: string;
  config: Readonly<RuntimeOptimizationConfig>;
  workerProvider: IAiProvider;
  tracer: IAgentTracer;
  interactionResponses: AgentInteractionResponse[];
  webPages: RuntimeEvaluationWebPage[];
  backgroundProcessHost: BackgroundCommandProcessHost;
  roots: { workItems: string; background: string; plans: string; worktrees: string; workers: string; teams: string };
};

export function createEvaluationToolRuntime(input: EvaluationRuntimeInput) {
  const local = new AgentToolExecutor({ provider: 'disabled' }, undefined, undefined, undefined, input.config.timeoutMs);
  const fetchContent = new FetchWebContent(
    new ScriptedEvaluationWebPageFetcher(input.webPages),
    { convert: async (html) => html },
    { analyze: async ({ content }) => content },
    { persist: async ({ body }) => ({ path: '/private/evaluation-webfetch.bin', size: body.byteLength }) },
  );
  const web = new WebFetchToolPlatform(local, local, fetchContent);
  const base = createNotebookToolPlatform(web, web);
  const workItems = new ManageAgentWorkItems(new JsonAgentWorkItemRepository({ directory: input.roots.workItems }));
  const backgroundSupervisor = new BackgroundCommandProcessSupervisor(
    input.roots.background, input.backgroundProcessHost, () => 'bg-runtime-eval',
  );
  const backgroundCommands = new ManageBackgroundCommands(backgroundSupervisor);
  const planManager = new ManageAgentPlanMode(new PrivateAgentPlanRepository(input.roots.plans));
  const hooks = { dispatch: async () => ({ matchedHookIds: [], contexts: [], auditLabels: [] }) };
  const worktrees = new ManageAgentWorktrees(
    new ScriptedEvaluationWorktreeGateway(input.roots.worktrees), new MemoryEvaluationWorktreeSessionRepository(), hooks,
  );
  const policy = new WebFetchPermissionPolicy(new ToolPermissionPolicy([]));
  const workers = new ManageAgentWorkers(new PrivateAgentWorkerRepository(input.roots.workers), input.tracer);
  const teams = new ManageAgentTeams(new PrivateAgentTeamRepository(input.roots.teams), workers, workItems);
  const workerExecution = createAgentWorkerExecution({
    provider: input.workerProvider,
    settings: {
      baseUrl: 'scripted://worker-evaluation', apiKey: '', model: input.config.modelChoice ?? 'scripted-worker',
      permissionMode: 'danger-full-access', retryCount: input.config.retryCount, requestTimeoutMs: input.config.timeoutMs,
      contextWindow: 16_384, contextBudgetTokens: input.config.contextBudgetTokens,
    },
    baseCatalog: base, baseExecutor: base, workers, teams, workItems, backgroundCommands, worktrees,
    createSessionBasePlatform: () => {
      const platform = createNotebookToolPlatform(web, web);
      return { catalog: platform, executor: platform };
    },
    profiles: { load: async () => { throw new Error('Evaluation agent profile is unavailable.'); } },
    formatter: new AttachmentMessageFormatter(), approval: { requestApproval: async () => true },
    audit: { record: async () => undefined }, tracer: input.tracer, policy, hooks, events: NOOP_WORKER_EVENTS,
  });
  const agentPlatform = new AgentWorkerToolPlatform(base, base, workers, workerExecution, { parentScopeId: input.taskId, depth: 0 });
  const teamPlatform = new AgentTeamToolPlatform(agentPlatform, agentPlatform, teams, workerExecution, { scopeId: input.taskId, depth: 0 });
  const taskPlatform = new TaskToolPlatform(teamPlatform, teamPlatform, workItems, {
    taskListId: () => teams.taskListId(input.taskId), requestId: input.taskId,
  });
  const backgroundPlatform = new BackgroundCommandToolPlatform(taskPlatform, taskPlatform, backgroundCommands, input.taskId, workers);
  const interactionGateway = new ScriptedInteractionGateway(input.interactionResponses);
  const interactivePlatform = new InteractiveToolPlatform(
    backgroundPlatform, backgroundPlatform, planManager, interactionGateway, NOOP_EVENT_SINK,
    { scopeId: input.taskId, requestId: input.taskId }, () => `interaction-runtime-${input.interactionResponses.length}`, hooks,
  );
  const worktreePlatform = new WorktreeToolPlatform(
    interactivePlatform, interactivePlatform, worktrees, NOOP_EVENT_SINK,
    { scopeId: input.taskId, requestId: input.taskId, originalWorkspaceRoot: input.workspaceRoot },
  );
  const compatibilityPlatform = new CompatibilityToolPlatform(worktreePlatform, worktreePlatform);
  const platform = new ToolSearchPlatform(compatibilityPlatform, compatibilityPlatform, worktreePlatform);
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
