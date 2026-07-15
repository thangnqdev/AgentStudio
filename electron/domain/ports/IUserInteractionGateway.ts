import type { AgentInteractionResponse } from '../entities/agentInteraction.js';

export interface IUserInteractionGateway {
  waitForResponse(
    requestId: string,
    interactionId: string,
    signal?: AbortSignal,
  ): Promise<AgentInteractionResponse>;
}
