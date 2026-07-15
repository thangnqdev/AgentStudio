import type { AgentWorktreeChangeSummary, AgentWorktreeSession } from '../entities/agentWorktree.js';

export interface IAgentWorktreeGateway {
  create(scopeId: string, workspaceRoot: string, name: string): Promise<AgentWorktreeSession>;
  verify(session: AgentWorktreeSession): Promise<boolean>;
  inspect(session: AgentWorktreeSession): Promise<AgentWorktreeChangeSummary | null>;
  remove(session: AgentWorktreeSession, force: boolean): Promise<{ branchRemoved: boolean }>;
}
