import type { AgentTaskCheckpoint, AgentTaskRecord, AgentTaskSummary } from '../entities/agentTask.js';

export interface IAgentTaskRepository {
  create(task: AgentTaskRecord): Promise<void>;
  get(taskId: string): Promise<AgentTaskRecord | null>;
  listResumable(workspaceRoot: string): Promise<AgentTaskSummary[]>;
  saveCheckpoint(checkpoint: AgentTaskCheckpoint): Promise<void>;
  recoverInterrupted(): Promise<AgentTaskRecord[]>;
  markPaused(taskId: string, reason?: string): Promise<void>;
  markFailed(taskId: string, error: string): Promise<void>;
}
