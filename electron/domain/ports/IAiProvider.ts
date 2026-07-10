import type { WebContents } from 'electron';
import type { AgentProviderSettings, AssistantResponse, ChatMessage } from '../../domain/entities/agent.js';

export interface IAiProvider {
  requestAssistantMessage(
    settings: AgentProviderSettings,
    messages: ChatMessage[],
    sender: WebContents,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<AssistantResponse>;
}
