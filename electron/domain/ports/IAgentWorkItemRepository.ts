import type { AgentWorkItemBoard } from '../entities/agentWorkItem.js';

export interface IAgentWorkItemRepository {
  load(taskListId: string): Promise<AgentWorkItemBoard>;
  save(taskListId: string, board: AgentWorkItemBoard): Promise<void>;
  delete(taskListId: string): Promise<void>;
}
