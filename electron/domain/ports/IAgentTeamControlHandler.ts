import type { AgentTeamProtocolMessage } from '../entities/agentTeamProtocol.js';

export interface IAgentTeamControlHandler {
  handle(message: AgentTeamProtocolMessage): Promise<boolean>;
}
