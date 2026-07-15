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

export * from './domain/entities/agent.js';

export const agentToolApprovalManager = new ElectronToolApprovalManager();
export const agentUserInteractionManager = new ElectronUserInteractionManager();
const toolAuditLogger = new JsonlToolAuditLogger();
const taskRepository = new JsonlAgentTaskRepository();
export const agentTraceService = new AgentTraceService(new JsonlAgentTraceRepository());
export const agentTaskService = new AgentTaskService(taskRepository, agentTraceService);
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
app.once('before-quit', () => { void backgroundCommandSupervisor.stopAll(); });

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
  const agentProfileContext = await agentProfileManager.buildPromptContext(workspaceRoot);
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
  const requestId = payload.requestId || task?.id || crypto.randomUUID();
  const taskScopeId = payload.taskListId || task?.id || payload.taskId || requestId;
  eventSink.emitPlanMode(requestId, { active: agentPlanManager.isActive(taskScopeId) });
  const taskToolPlatform = new TaskToolPlatform(
    delegatingToolPlatform,
    delegatingToolPlatform,
    agentWorkItemManager,
    { taskListId: taskScopeId, requestId: payload.requestId },
  );
  const backgroundToolPlatform = new BackgroundCommandToolPlatform(
    taskToolPlatform,
    taskToolPlatform,
    backgroundCommandManager,
    taskScopeId,
  );
  const toolPlatform = new InteractiveToolPlatform(
    backgroundToolPlatform,
    backgroundToolPlatform,
    agentPlanManager,
    agentUserInteractionManager,
    eventSink,
    { scopeId: taskScopeId, requestId },
  );
  const sessionPolicy = new PlanAwareToolPermissionPolicy(toolPermissionPolicy, agentPlanManager, taskScopeId);
  const session = new RunAgentSession(provider, toolPlatform, toolPlatform, new AttachmentMessageFormatter(), agentToolApprovalManager, toolAuditLogger, agentTraceService, sessionPolicy, lifecycleHookDispatcher);
  const combinedSkillContext = [skillContext, agentProfileContext].filter(Boolean).join('\n\n');
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
    }
    : undefined);
  if (task && result?.status) {
    eventSink.emitTaskStatus(payload.requestId || '', { taskId: task.id, status: result.status, completedSteps: result.completedSteps });
  }
  return result;
}
