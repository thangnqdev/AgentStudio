import type { AgentTeamTransportFrame, AuthenticatedAgentTeamPeer } from '../entities/agentTeamTransport.js';

export type AgentTeamTransportReceiver = (
  peer: AuthenticatedAgentTeamPeer,
  frame: AgentTeamTransportFrame,
) => void | Promise<void>;

export interface IAgentTeamTransport {
  start(receiver: AgentTeamTransportReceiver): Promise<void>;
  send(workerId: string, messageId: string, payload: string): Promise<boolean>;
  disconnect(workerId: string): void;
  shutdown(): Promise<void>;
}
