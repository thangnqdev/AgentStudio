import { app, type WebContents } from 'electron';
import path from 'node:path';
import type { AgentStartPayload, AgentProviderSettings } from './domain/entities/agent.js';
import { RunAgentSession } from './application/usecases/RunAgentSession.js';
import { OpenAIProvider } from './infrastructure/providers/OpenAIProvider.js';
import { ElectronAgentEventSink } from './infrastructure/ElectronAgentEventSink.js';
import { AgentToolExecutor } from './infrastructure/tools/AgentToolExecutor.js';
import { AttachmentMessageFormatter } from './infrastructure/ai/AttachmentMessageFormatter.js';
import { ElectronToolApprovalManager } from './infrastructure/tools/ElectronToolApprovalManager.js';
import { JsonlToolAuditLogger } from './infrastructure/tools/JsonlToolAuditLogger.js';
import { JsonlAgentTaskRepository } from './infrastructure/tasks/JsonlAgentTaskRepository.js';
import { AgentTaskService } from './application/usecases/AgentTaskService.js';
import type { AgentTaskRecord } from './domain/entities/agentTask.js';
import { webSearchSettingsRepository } from './infrastructure/WebSearchSettingsRepository.js';
import { skillManager } from './skillRuntime.js';
import { mcpGateway } from './mcpRuntime.js';
import { JsonlAgentTraceRepository } from './infrastructure/tracing/JsonlAgentTraceRepository.js';
import { AgentTraceService } from './application/services/AgentTraceService.js';
import type { RuntimeOptimizationConfig } from './domain/entities/optimizer.js';
import { toolPermissionPolicy } from './permissionRuntime.js';
import { RunReadOnlySubagent } from './application/usecases/RunReadOnlySubagent.js';
import { DelegatingToolPlatform } from './application/services/DelegatingToolPlatform.js';
import { agentProfileManager } from './agentProfileRuntime.js';
import { lifecycleHookDispatcher } from './hookRuntime.js';
import { JsonAgentWorkItemRepository } from './infrastructure/tasks/JsonAgentWorkItemRepository.js';
import { ManageAgentWorkItems } from './application/usecases/ManageAgentWorkItems.js';
import { TaskToolPlatform } from './application/services/TaskToolPlatform.js';
import { BackgroundCommandProcessSupervisor } from './infrastructure/tasks/BackgroundCommandProcessSupervisor.js';
import { ManageBackgroundCommands } from './application/usecases/ManageBackgroundCommands.js';
import { BackgroundCommandToolPlatform } from './application/services/BackgroundCommandToolPlatform.js';
import { ElectronUserInteractionManager } from './infrastructure/interactions/ElectronUserInteractionManager.js';
import { PrivateAgentPlanRepository } from './infrastructure/plans/PrivateAgentPlanRepository.js';
import { ManageAgentPlanMode } from './application/usecases/ManageAgentPlanMode.js';
import { InteractiveToolPlatform } from './application/services/InteractiveToolPlatform.js';
import { PlanAwareToolPermissionPolicy } from './application/services/PlanAwareToolPermissionPolicy.js';
import { GitAgentWorktreeGateway } from './infrastructure/worktrees/GitAgentWorktreeGateway.js';
import { PrivateAgentWorktreeSessionRepository } from './infrastructure/worktrees/PrivateAgentWorktreeSessionRepository.js';
import { ManageAgentWorktrees } from './application/usecases/ManageAgentWorktrees.js';
import { WorktreeToolPlatform } from './application/services/WorktreeToolPlatform.js';
import { PrivateAgentWorkerRepository } from './infrastructure/agents/PrivateAgentWorkerRepository.js';
import { ManageAgentWorkers } from './application/usecases/ManageAgentWorkers.js';
import { ElectronAgentWorkerEventSink } from './infrastructure/agents/ElectronAgentWorkerEventSink.js';
import { createAgentWorkerExecution } from './infrastructure/agents/createAgentWorkerExecution.js';
import { AgentWorkerToolPlatform } from './application/services/AgentWorkerToolPlatform.js';
import { formatAgentNotificationContext } from './application/services/agentNotificationContext.js';

export * from './domain/entities/agent.js';

export const agentToolApprovalManager = new ElectronToolApprovalManager();
export const agentUserInteractionManager = new ElectronUserInteractionManager();
const toolAuditLogger = new JsonlToolAuditLogger();
const taskRepository = new JsonlAgentTaskRepository();
export const agentTraceService = new AgentTraceService(new JsonlAgentTraceRepository());
export const agentTaskService = new AgentTaskService(taskRepository, agentTraceService);
export const agentWorkerManager = new ManageAgentWorkers(
  new PrivateAgentWorkerRepository(() => path.join(app.getPath('userData'), 'agent-workers')),
  agentTraceService,
  {
    cancel: (requestId) => agentToolApprovalManager.cancelRequest(requestId),
    respond: (requestId, actionId, approved) => agentToolApprovalManager.respond(requestId, actionId, approved),
  },
);
export const agentWorkerRecovery = agentWorkerManager.recoverInterrupted().catch(() => []);
const agentWorkItemManager = new ManageAgentWorkItems(new JsonAgentWorkItemRepository({
  directory: () => path.join(app.getPath('userData'), 'agent-work-items'),
}), lifecycleHookDispatcher);
const backgroundCommandSupervisor = new BackgroundCommandProcessSupervisor(
  () => path.join(app.getPath('userData'), 'background-command-output'),
);
const backgroundCommandManager = new ManageBackgroundCommands(backgroundCommandSupervisor);
const agentPlanManager = new ManageAgentPlanMode(new PrivateAgentPlanRepository(
  () => path.join(app.getPath('userData'), 'agent-plans'),
));
export const agentWorktreeManager = new ManageAgentWorktrees(
  new GitAgentWorktreeGateway(() => path.join(app.getPath('userData'), 'managed-worktrees')),
  new PrivateAgentWorktreeSessionRepository(() => path.join(app.getPath('userData'), 'agent-worktree-sessions')),
);
app.once('before-quit', () => {
  void backgroundCommandSupervisor.stopAll();
  void agentWorkerManager.stopAll();
});

export function resolveAgentSessionScope(payload: AgentStartPayload, requestId: string) {
  return payload.taskListId || payload.taskId || requestId;
}

export async function runAgentSession(
  payload: AgentStartPayload,
  sender: WebContents,
  settings: AgentProviderSettings,
  workspaceRoot: string,
  knowledgeContext?: string,
  skillContext?: string,
  signal?: AbortSignal,
  task?: AgentTaskRecord,
  tuning?: RuntimeOptimizationConfig,
) {
  const webSearchSettings = await webSearchSettingsRepository.load();
  const provider = new OpenAIProvider();
  const eventSink = new ElectronAgentEventSink(sender);
  const workerEventSink = new ElectronAgentWorkerEventSink(sender);
  const requestId = payload.requestId || task?.id || crypto.randomUUID();
  const taskScopeId = resolveAgentSessionScope(payload, requestId);
  await agentWorktreeManager.restore(taskScopeId, workspaceRoot);
  const runtimeWorkspaceRoot = agentWorktreeManager.currentRoot(taskScopeId, workspaceRoot);
  const agentProfileContext = await agentProfileManager.buildPromptContext(runtimeWorkspaceRoot);
  const baseToolPlatform = new AgentToolExecutor(
    webSearchSettings,
    async (skillId, root) => {
      const loaded = await skillManager.loadInstructions(root, skillId);
      return `<skill name="${loaded.skill.name}">\n${loaded.instructions}\n</skill>`;
    },
    mcpGateway,
    mcpGateway,
    tuning?.timeoutMs,
  );
  const subagent = new RunReadOnlySubagent(
    provider,
    baseToolPlatform,
    baseToolPlatform,
    settings,
    toolPermissionPolicy,
    signal,
    agentProfileManager,
    skillContext,
  );
  const delegatingToolPlatform = new DelegatingToolPlatform(baseToolPlatform, baseToolPlatform, subagent);
  const attachmentFormatter = new AttachmentMessageFormatter();
  const workerExecution = createAgentWorkerExecution({
    provider, settings, baseCatalog: baseToolPlatform, baseExecutor: baseToolPlatform,
    workers: agentWorkerManager, workItems: agentWorkItemManager, backgroundCommands: backgroundCommandManager,
    worktrees: agentWorktreeManager, profiles: agentProfileManager, formatter: attachmentFormatter,
    approval: agentToolApprovalManager, audit: toolAuditLogger, tracer: agentTraceService,
    policy: toolPermissionPolicy, hooks: lifecycleHookDispatcher, events: workerEventSink,
  });
  const agentWorkerPlatform = new AgentWorkerToolPlatform(
    delegatingToolPlatform, delegatingToolPlatform, agentWorkerManager, workerExecution,
    { parentScopeId: taskScopeId, depth: 0 },
  );
  eventSink.emitPlanMode(requestId, { active: agentPlanManager.isActive(taskScopeId) });
  eventSink.emitWorktree(requestId, agentWorktreeManager.state(taskScopeId));
  const taskToolPlatform = new TaskToolPlatform(
    agentWorkerPlatform,
    agentWorkerPlatform,
    agentWorkItemManager,
    { taskListId: taskScopeId, requestId: payload.requestId },
  );
  const backgroundToolPlatform = new BackgroundCommandToolPlatform(
    taskToolPlatform,
    taskToolPlatform,
    backgroundCommandManager,
    taskScopeId,
  );
  const interactiveToolPlatform = new InteractiveToolPlatform(
    backgroundToolPlatform,
    backgroundToolPlatform,
    agentPlanManager,
    agentUserInteractionManager,
    eventSink,
    { scopeId: taskScopeId, requestId },
  );
  const toolPlatform = new WorktreeToolPlatform(
    interactiveToolPlatform,
    interactiveToolPlatform,
    agentWorktreeManager,
    eventSink,
    { scopeId: taskScopeId, requestId, originalWorkspaceRoot: workspaceRoot },
  );
  const sessionPolicy = new PlanAwareToolPermissionPolicy(toolPermissionPolicy, agentPlanManager, taskScopeId);
  const session = new RunAgentSession(provider, toolPlatform, toolPlatform, attachmentFormatter, agentToolApprovalManager, toolAuditLogger, agentTraceService, sessionPolicy, lifecycleHookDispatcher);
  const notifications = await agentWorkerManager.drainParentMessages(taskScopeId);
  const notificationContext = formatAgentNotificationContext(notifications);
  const combinedSkillContext = [skillContext, agentProfileContext, notificationContext].filter(Boolean).join('\n\n');
  const result = await session.execute(payload, eventSink, settings, workspaceRoot, knowledgeContext, combinedSkillContext, signal, task
    ? {
      id: task.id,
      traceId: task.traceId,
      workspaceRoot: task.workspaceRoot,
      completedSteps: task.completedSteps,
      messages: task.messages,
      conversation: task.conversation,
      knowledgeContext: task.knowledgeContext,
      onCheckpoint: (checkpoint) => agentTaskService.checkpoint(checkpoint),
      drainMessages: () => agentWorkerManager.drainParentMessages(taskScopeId),
    }
    : undefined, toolPlatform);
  if (task && result?.status) {
    eventSink.emitTaskStatus(payload.requestId || '', { taskId: task.id, status: result.status, completedSteps: result.completedSteps });
  }
  return result;
}
