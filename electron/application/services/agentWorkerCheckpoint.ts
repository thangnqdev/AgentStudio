import type { AgentTaskCheckpoint } from '../../domain/entities/agentTask.js';
import type { AgentWorkerCheckpoint, AgentWorkerRecord } from '../../domain/entities/agentWorker.js';

export function toWorkerCheckpoint(worker: AgentWorkerRecord, checkpoint: AgentTaskCheckpoint, result: string): AgentWorkerCheckpoint {
  return {
    id: worker.id, status: checkpoint.status, updatedAt: new Date().toISOString(), completedSteps: checkpoint.completedSteps,
    messages: checkpoint.messages, conversation: checkpoint.conversation, ...(result ? { result } : {}),
  };
}
