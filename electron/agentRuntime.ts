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
import { toolPermissionPolicy, userPermissionRuleWriter } from './permissionRuntime.js';
import { RunReadOnlySubagent } from './application/usecases/RunReadOnlySubagent.js';
import { DelegatingToolPlatform } from './application/services/DelegatingToolPlatform.js';
import { agentProfileManager } from './agentProfileRuntime.js';
import { lifecycleHookDispatcher } from './hookRuntime.js';
import { JsonAgentWorkItemRepository } from './infrastructure/tasks/JsonAgentWorkItemRepository.js';
import { ManageAgentWorkItems } from './application/usecases/ManageAgentWorkItems.js';
import { TaskToolPlatform } from './application/services/TaskToolPlatform.js';
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
import { AgentTeamToolPlatform } from './application/services/AgentTeamToolPlatform.js';
import { formatAgentNotificationContext } from './application/services/agentNotificationContext.js';
import { ToolSearchPlatform } from './application/services/ToolSearchPlatform.js';
import { extractLoadedToolNames } from './application/services/toolSearchHistory.js';
import { createWebFetchToolPlatform } from './infrastructure/web/createWebFetchToolPlatform.js';
import { createNotebookToolPlatform } from './infrastructure/notebooks/createNotebookToolPlatform.js';
import { createLspToolPlatform, lspDiagnosticHub, lspGateway } from './lspRuntime.js';
import { createAgentTeamRuntime } from './agentTeamRuntime.js';
import { CompatibilityToolPlatform } from './application/services/CompatibilityToolPlatform.js';
import { createCronRuntime } from './infrastructure/cron/createCronRuntime.js';
import { AgentCronFireSink } from './infrastructure/cron/AgentCronFireSink.js';
import { remoteTriggerRuntime } from './remoteTriggerRuntime.js';
import { fileURLToPath } from 'node:url';
import { LocalAgentWorkerSessionProcessHost } from './infrastructure/agents/LocalAgentWorkerSessionProcessHost.js';
import { settingsRepo } from './infrastructure/JsonSettingsRepository.js';
import { ManageAgentConfig } from './application/usecases/ManageAgentConfig.js';
import { ConfigToolPlatform } from './application/services/ConfigToolPlatform.js';
import { createAgentAmbientContext } from './agentAmbientRuntime.js';
import { backgroundCommandManager, backgroundCommandSupervisor } from './backgroundCommandRuntime.js';
import { LifecycleAwareAgentSession } from './application/services/LifecycleAwareAgentSession.js';
import { workspaceFileChanges } from './fileChangeRuntime.js';

export * from './domain/entities/agent.js';

export const agentToolApprovalManager = new ElectronToolApprovalManager(userPermissionRuleWriter);
export const agentUserInteractionManager = new ElectronUserInteractionManager();
const toolAuditLogger = new JsonlToolAuditLogger();
const taskRepository = new JsonlAgentTaskRepository();
export const agentTraceService = new AgentTraceService(new JsonlAgentTraceRepository());
export const agentTaskService = new AgentTaskService(taskRepository, agentTraceService);
const agentWorkerRepository = new PrivateAgentWorkerRepository(() => path.join(app.getPath('userData'), 'agent-workers'));
const agentCronFireSink = new AgentCronFireSink(agentWorkerRepository);
const agentCronRuntime = createCronRuntime(
  () => path.join(app.getPath('userData'), 'agent-cron'),
  agentCronFireSink,
);
const agentWorkerProcessHost = new LocalAgentWorkerSessionProcessHost(
  fileURLToPath(new URL(/* @vite-ignore */ './agent-worker-process.js', import.meta.url)),
);
export const agentWorkerManager = new ManageAgentWorkers(
  agentWorkerRepository,
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
const agentTeamRuntime = createAgentTeamRuntime(agentWorkerManager, agentWorkerRepository, agentWorkItemManager, agentToolApprovalManager, lifecycleHookDispatcher);
export const agentTeamEventHub = agentTeamRuntime.events;
export const agentTeamManager = agentTeamRuntime.manager;
export const agentTeamProtocolReady = agentTeamRuntime.ready;
const agentPlanManager = new ManageAgentPlanMode(new PrivateAgentPlanRepository(
  () => path.join(app.getPath('userData'), 'agent-plans'),
));
export const agentWorktreeManager = new ManageAgentWorktrees(
  new GitAgentWorktreeGateway(() => path.join(app.getPath('userData'), 'managed-worktrees')),
  new PrivateAgentWorktreeSessionRepository(() => path.join(app.getPath('userData'), 'agent-worktree-sessions')),
  lifecycleHookDispatcher,
);
app.once('before-quit', () => {
  void agentWorkerManager.stopAll();
  void agentTeamRuntime.stop();
  agentCronRuntime.stopAll();
  agentCronFireSink.clear();
  void lspGateway.shutdownAll();
  lspDiagnosticHub.reset();
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
  const requestId = payload.requestId || task?.id || crypto.randomUUID();
  const taskScopeId = resolveAgentSessionScope(payload, requestId);
  agentTeamEventHub.attach(taskScopeId, sender);
  const workerEventSink = new ElectronAgentWorkerEventSink(sender, (worker) => {
    if (worker.status !== 'running') void agentTeamRuntime.idlePublisher.execute(worker).catch(() => undefined);
    void agentTeamManager.view(worker.parentScopeId)
      .then((team) => agentTeamEventHub.emitTeam(worker.parentScopeId, team))
      .catch(() => undefined);
  });
  await agentWorktreeManager.restore(taskScopeId, workspaceRoot);
  const runtimeWorkspaceRoot = agentWorktreeManager.currentRoot(taskScopeId, workspaceRoot);
  const agentProfileContext = await agentProfileManager.buildPromptContext(runtimeWorkspaceRoot);
  const localToolPlatform = new AgentToolExecutor(
    webSearchSettings,
    async (skillId, root) => {
      const loaded = await skillManager.loadInstructions(root, skillId);
      return `<skill name="${loaded.skill.name}">\n${loaded.instructions}\n</skill>`;
    },
    mcpGateway,
    mcpGateway,
    tuning?.timeoutMs,
    workspaceFileChanges,
  );
  const configToolPlatform = new ConfigToolPlatform(
    localToolPlatform,
    localToolPlatform,
    new ManageAgentConfig(settingsRepo),
    (change) => {
      Object.assign(settings, change.runtime);
      if (!sender.isDestroyed()) sender.send('settings:changed', change.publicSettings);
    },
    lifecycleHookDispatcher,
  );
  const webToolPlatform = createWebFetchToolPlatform({
    baseCatalog: configToolPlatform,
    baseExecutor: configToolPlatform,
    provider,
    settings,
    userDataDirectory: () => app.getPath('userData'),
  });
  const lspToolPlatform = createLspToolPlatform(webToolPlatform, webToolPlatform);
  const baseToolPlatform = createNotebookToolPlatform(lspToolPlatform, lspToolPlatform, workspaceFileChanges);
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
    createSessionBasePlatform: () => {
      const platform = createNotebookToolPlatform(lspToolPlatform, lspToolPlatform, workspaceFileChanges);
      return { catalog: platform, executor: platform };
    },
    workers: agentWorkerManager, teams: agentTeamManager, workItems: agentWorkItemManager, backgroundCommands: backgroundCommandManager,
    worktrees: agentWorktreeManager, profiles: agentProfileManager, formatter: attachmentFormatter,
    approval: agentToolApprovalManager, audit: toolAuditLogger, tracer: agentTraceService,
    policy: toolPermissionPolicy, hooks: lifecycleHookDispatcher, ambientContext: lspDiagnosticHub, events: workerEventSink,
    cron: agentCronRuntime,
    remoteTriggers: remoteTriggerRuntime,
    processHost: agentWorkerProcessHost,
  });
  const agentWorkerPlatform = new AgentWorkerToolPlatform(
    delegatingToolPlatform, delegatingToolPlatform, agentWorkerManager, workerExecution,
    { parentScopeId: taskScopeId, depth: 0 },
  );
  const teamContext = { scopeId: taskScopeId, depth: 0 };
  const agentTeamPlatform = new AgentTeamToolPlatform(
    agentWorkerPlatform, agentWorkerPlatform, agentTeamManager, workerExecution, teamContext,
  );
  eventSink.emitPlanMode(requestId, { active: agentPlanManager.isActive(taskScopeId) });
  eventSink.emitWorktree(requestId, agentWorktreeManager.state(taskScopeId));
  const taskToolPlatform = new TaskToolPlatform(
    agentTeamPlatform,
    agentTeamPlatform,
    agentWorkItemManager,
    {
      taskListId: () => agentTeamManager.taskListId(taskScopeId), requestId: payload.requestId,
      onOwnerChanged: (item) => agentTeamManager.assignTask(taskScopeId, item, {
        ...teamContext, workspaceRoot: runtimeWorkspaceRoot, permissionMode: settings.permissionMode,
      }, workerExecution),
    },
  );
  const backgroundToolPlatform = new BackgroundCommandToolPlatform(
    taskToolPlatform,
    taskToolPlatform,
    backgroundCommandManager,
    taskScopeId,
    agentWorkerManager,
  );
  const interactiveToolPlatform = new InteractiveToolPlatform(
    backgroundToolPlatform,
    backgroundToolPlatform,
    agentPlanManager,
    agentUserInteractionManager,
    eventSink,
    { scopeId: taskScopeId, requestId },
    undefined,
    lifecycleHookDispatcher,
  );
  const worktreePlatform = new WorktreeToolPlatform(
    interactiveToolPlatform,
    interactiveToolPlatform,
    agentWorktreeManager,
    eventSink,
    { scopeId: taskScopeId, requestId, originalWorkspaceRoot: workspaceRoot },
  );
  const restoredToolNames = extractLoadedToolNames(task?.messages.length ? task.messages : payload.messages ?? []);
  const cronPlatform = agentCronRuntime.decorate(worktreePlatform, worktreePlatform, {
    scopeId: taskScopeId, ownerId: `lead:${taskScopeId}`, ownerKind: 'lead',
  });
  const remoteTriggerPlatform = remoteTriggerRuntime.decorate(cronPlatform, cronPlatform);
  const compatibilityPlatform = new CompatibilityToolPlatform(remoteTriggerPlatform, remoteTriggerPlatform);
  const toolPlatform = new ToolSearchPlatform(
    compatibilityPlatform, compatibilityPlatform, worktreePlatform, restoredToolNames,
  );
  const sessionPolicy = new PlanAwareToolPermissionPolicy(toolPermissionPolicy, agentPlanManager, taskScopeId);
  const ambientContext = createAgentAmbientContext(backgroundCommandSupervisor, taskScopeId);
  const baseSession = new RunAgentSession(
    provider, toolPlatform, toolPlatform, attachmentFormatter, agentToolApprovalManager,
    toolAuditLogger, agentTraceService, sessionPolicy, lifecycleHookDispatcher, ambientContext,
  );
  const session = new LifecycleAwareAgentSession(baseSession, lifecycleHookDispatcher, {
    workspaceRoot: () => agentWorktreeManager.currentRoot(taskScopeId, workspaceRoot), requestId, taskId: task?.id,
  });
  const notifications = await agentWorkerManager.drainParentMessages(taskScopeId);
  const notificationContext = formatAgentNotificationContext(notifications);
  const combinedSkillContext = [skillContext, agentProfileContext, notificationContext].filter(Boolean).join('\n\n');
  const unregisterCronDelivery = agentCronFireSink.registerTeammateDelivery(taskScopeId, async (scope, content) => {
    await agentWorkerManager.send(
      { to: scope.ownerId, message: content },
      { parentScopeId: scope.scopeId, workspaceRoot: scope.workspaceRoot, permissionMode: settings.permissionMode, depth: 0 },
      workerExecution,
    );
  });
  try {
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
      : undefined, toolPlatform, {
        waitForBackgroundResults: (waitSignal) => agentWorkerManager.waitForBackgroundResults(taskScopeId, waitSignal),
      });
    if (task && result?.status) {
      eventSink.emitTaskStatus(payload.requestId || '', { taskId: task.id, status: result.status, completedSteps: result.completedSteps });
    }
    return result;
  } finally {
    unregisterCronDelivery();
  }
}
