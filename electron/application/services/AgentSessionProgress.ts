import type { AgentTaskCheckpoint } from '../../domain/entities/agentTask.js';
import type { ChatMessage, Message, ModelTokenUsage } from '../../domain/entities/agent.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import type { AgentTaskRun } from '../usecases/AgentTaskRun.js';

export async function checkpointAgentTask(
  task: AgentTaskRun | undefined,
  status: AgentTaskCheckpoint['status'],
  completedSteps: number,
  messages: Message[],
  conversation: ChatMessage[],
) {
  if (!task?.onCheckpoint) return;
  await task.onCheckpoint({
    id: task.id, traceId: task.traceId, workspaceRoot: task.workspaceRoot,
    status, completedSteps, messages, conversation, knowledgeContext: task.knowledgeContext,
  });
}

export async function recordAgentModelSpan(
  tracer: IAgentTracer,
  task: AgentTaskRun | undefined,
  input: {
    requestId: string; step: number; startedAt: string; model: string;
    status: 'succeeded' | 'failed'; finishReason?: string; usage?: ModelTokenUsage;
  },
) {
  if (!task) return;
  await tracer.recordSpan({
    kind: 'model_call', traceId: task.traceId, taskId: task.id,
    ...input, endedAt: new Date().toISOString(),
  }).catch(() => undefined);
}
