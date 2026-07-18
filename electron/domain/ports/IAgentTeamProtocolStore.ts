import type { AgentTeamProtocolMessage } from '../entities/agentTeamProtocol.js';

export type AgentTeamProtocolClaim = {
  message: AgentTeamProtocolMessage;
  leaseId: string;
  leasedUntil: string;
};

export interface IAgentTeamProtocolStore {
  append(message: AgentTeamProtocolMessage): Promise<boolean>;
  claim(teamId: string, recipient: string, leaseOwner: string, leaseDurationMs?: number): Promise<AgentTeamProtocolClaim | null>;
  ack(teamId: string, messageId: string, leaseId: string): Promise<boolean>;
  release(teamId: string, messageId: string, leaseId: string): Promise<boolean>;
}
