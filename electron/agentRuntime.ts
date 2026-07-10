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

export * from './domain/entities/agent.js';

export const agentToolApprovalManager = new ElectronToolApprovalManager();
const toolAuditLogger = new JsonlToolAuditLogger();
const taskRepository = new JsonAgentTaskRepository();
export const agentTaskService = new AgentTaskService(taskRepository);

export async function runAgentSession(
  payload: AgentStartPayload,
  sender: WebContents,
  settings: AgentProviderSettings,
  workspaceRoot: string,
  knowledgeContext?: string,
  signal?: AbortSignal,
  task?: AgentTaskRecord,
) {
  const webSearchSettings = await webSearchSettingsRepository.load();
  const providerSettings = { ...settings, webSearchEnabled: webSearchSettings.provider !== 'disabled' };
  const provider = new OpenAIProvider();
  const eventSink = new ElectronAgentEventSink(sender);
  const toolExecutor = new AgentToolExecutor(webSearchSettings);
  const session = new RunAgentSession(provider, toolExecutor, new AttachmentMessageFormatter(), agentToolApprovalManager, toolAuditLogger);
  const result = await session.execute(payload, eventSink, providerSettings, workspaceRoot, knowledgeContext, signal, task
    ? {
      id: task.id,
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
