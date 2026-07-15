import type { AgentTeamRecord } from '../entities/agentTeam.js';

export interface IAgentTeamRepository {
  create(team: AgentTeamRecord): Promise<void>;
  getByScope(scopeId: string): Promise<AgentTeamRecord | null>;
  list(): Promise<AgentTeamRecord[]>;
  save(team: AgentTeamRecord): Promise<void>;
  delete(scopeId: string): Promise<void>;
}
