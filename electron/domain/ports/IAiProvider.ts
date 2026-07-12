import type { AgentProviderSettings, AssistantResponse, ChatMessage } from '../entities/agent.js';
import type { IAgentEventSink } from './IAgentEventSink.js';
import type { AgentToolDefinition } from '../entities/tool.js';

export interface IAiProvider {
  requestAssistantMessage(
    settings: AgentProviderSettings,
    messages: ChatMessage[],
    tools: AgentToolDefinition[],
    eventSink: IAgentEventSink,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<AssistantResponse>;
}
