import type { AgentWorkerCheckpoint, AgentWorkerNotification, AgentWorkerRecord } from '../entities/agentWorker.js';
import type { Message } from '../entities/agent.js';

export interface IAgentWorkerRepository {
  create(worker: AgentWorkerRecord): Promise<void>;
  get(agentId: string): Promise<AgentWorkerRecord | null>;
  list(parentScopeId: string): Promise<AgentWorkerRecord[]>;
  saveCheckpoint(checkpoint: AgentWorkerCheckpoint): Promise<void>;
  enqueueMessage(agentId: string, message: Message): Promise<void>;
  drainMessages(agentId: string): Promise<Message[]>;
  addNotification(notification: AgentWorkerNotification): Promise<void>;
  drainNotifications(parentScopeId: string): Promise<AgentWorkerNotification[]>;
  recoverInterrupted(): Promise<AgentWorkerRecord[]>;
}
