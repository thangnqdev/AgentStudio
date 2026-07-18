export const AGENT_TEAM_PROTOCOL_VERSION = 1;
export const MAX_AGENT_TEAM_TRANSPORT_FRAME_BYTES = 256 * 1_024;

export type AgentTeamHandshakePayload = {
  version: typeof AGENT_TEAM_PROTOCOL_VERSION;
  teamId: string;
  workerId: string;
  instanceId: string;
  epoch: number;
  timestamp: number;
  nonce: string;
};

export type AgentTeamHandshake = AgentTeamHandshakePayload & { signature: string };

export type AuthenticatedAgentTeamPeer = Omit<AgentTeamHandshakePayload, 'version' | 'timestamp' | 'nonce'>;

export type AgentTeamTransportFrame =
  | { type: 'message'; messageId: string; recipient: string; payload: string }
  | { type: 'ack'; messageId: string }
  | { type: 'heartbeat'; timestamp: number };
