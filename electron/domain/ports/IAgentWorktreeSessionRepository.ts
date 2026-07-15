import type { AgentWorktreeSession } from '../entities/agentWorktree.js';

export interface IAgentWorktreeSessionRepository {
  load(scopeId: string): Promise<AgentWorktreeSession | null>;
  save(session: AgentWorktreeSession): Promise<void>;
  remove(scopeId: string): Promise<void>;
}
