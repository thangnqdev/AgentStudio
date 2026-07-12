import type { WebContents } from 'electron';
import type { AgentStartPayload, AgentProviderSettings } from './domain/entities/agent.js';
import { RunAgentSession } from './application/usecases/RunAgentSession.js';
import { OpenAIProvider } from './infrastructure/providers/OpenAIProvider.js';
import { ElectronAgentEventSink } from './infrastructure/ElectronAgentEventSink.js';
import { AgentToolExecutor } from './infrastructure/tools/AgentToolExecutor.js';
import { AttachmentMessageFormatter } from './infrastructure/ai/AttachmentMessageFormatter.js';
import { ElectronToolApprovalManager } from './infrastructure/tools/ElectronToolApprovalManager.js';
import { JsonlToolAuditLogger } from './infrastructure/tools/JsonlToolAuditLogger.js';
import { JsonAgentTaskRepository } from './infrastructure/tasks/JsonAgentTaskRepository.js';
import { AgentTaskService } from './application/usecases/AgentTaskService.js';
import type { AgentTaskRecord } from './domain/entities/agentTask.js';
import { webSearchSettingsRepository } from './infrastructure/WebSearchSettingsRepository.js';
import { skillManager } from './skillRuntime.js';
import { mcpGateway } from './mcpRuntime.js';
import { JsonlAgentTraceRepository } from './infrastructure/tracing/JsonlAgentTraceRepository.js';
import { AgentTraceService } from './application/services/AgentTraceService.js';
import type { RuntimeOptimizationConfig } from './domain/entities/optimizer.js';

export * from './domain/entities/agent.js';

export const agentToolApprovalManager = new ElectronToolApprovalManager();
const toolAuditLogger = new JsonlToolAuditLogger();
const taskRepository = new JsonAgentTaskRepository();
export const agentTraceService = new AgentTraceService(new JsonlAgentTraceRepository());
export const agentTaskService = new AgentTaskService(taskRepository, agentTraceService);

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
  const toolExecutor = new AgentToolExecutor(
    webSearchSettings,
    async (skillId, root) => {
      const loaded = await skillManager.loadInstructions(root, skillId);
      return `<skill name="${loaded.skill.name}">\n${loaded.instructions}\n</skill>`;
    },
    mcpGateway,
    mcpGateway,
    tuning?.timeoutMs,
  );
  const session = new RunAgentSession(provider, toolExecutor, toolExecutor, new AttachmentMessageFormatter(), agentToolApprovalManager, toolAuditLogger, agentTraceService);
  const result = await session.execute(payload, eventSink, settings, workspaceRoot, knowledgeContext, skillContext, signal, task
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
