import type { AgentTeamView } from '../entities/agentTeam.js';

export interface IAgentTeamEventSink {
  emitTeam(scopeId: string, team: AgentTeamView | null): void;
}
