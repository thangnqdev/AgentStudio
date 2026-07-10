import type { AgentProviderSettings, AssistantResponse, ChatMessage } from '../entities/agent.js';
import type { IAgentEventSink } from './IAgentEventSink.js';

export interface IAiProvider {
  requestAssistantMessage(
    settings: AgentProviderSettings,
    messages: ChatMessage[],
    eventSink: IAgentEventSink,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<AssistantResponse>;
}
