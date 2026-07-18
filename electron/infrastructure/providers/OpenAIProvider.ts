import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import type { AgentProviderSettings, AssistantResponse, ChatMessage } from '../../domain/entities/agent.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import { getResponseTokenLimit } from '../../domain/entities/tokenBudget.js';
import type { AgentToolDefinition } from '../../domain/entities/tool.js';
import { createProviderHttpError, createProviderTransportError } from './OpenAIProviderErrors.js';
import { OpenAiChatStreamAccumulator, SseDataDecoder } from './openAiStreamProtocol.js';

function toProviderToolDefinitions(tools: AgentToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: { ...tool.parameters, type: 'object' },
    },
  }));
}

export class OpenAIProvider implements IAiProvider {
  async requestAssistantMessage(
    settings: AgentProviderSettings,
    messages: ChatMessage[],
    tools: AgentToolDefinition[],
    eventSink: IAgentEventSink,
    requestId: string,
    signal?: AbortSignal,
  ): Promise<AssistantResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (settings.apiKey) {
      headers.Authorization = `Bearer ${settings.apiKey}`;
    }

    let response = await this.fetchCompletion(settings, messages, tools, headers, signal, true);

    if (!response.ok) {
      const errorText = await response.text();
      if ([400, 422].includes(response.status) && /stream[_ -]?options/i.test(errorText)) {
        response = await this.fetchCompletion(settings, messages, tools, headers, signal, false);
      } else {
        throw createProviderHttpError(response.status, errorText, response.headers.get('retry-after'));
      }
    }
    if (!response.ok) {
      throw createProviderHttpError(response.status, await response.text(), response.headers.get('retry-after'));
    }

    if (!response.body) {
      throw new Error('No response body returned from the API.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const sse = new SseDataDecoder();
    const accumulator = new OpenAiChatStreamAccumulator();
    const consume = (data: string) => {
      const result = accumulator.consumeData(data);
      if (result.contentDelta) eventSink.emitChunk(requestId, result.contentDelta);
      return result.done;
    };

    while (true) {
      if (signal?.aborted) throw new Error('Agent session stopped.');

      const { done, value } = await reader.read().catch((error) => {
        if (signal?.aborted) throw error;
        throw createProviderTransportError(error);
      });
      if (done) break;
      for (const data of sse.push(decoder.decode(value, { stream: true }))) {
        if (consume(data)) return accumulator.result();
      }
    }

    for (const data of [...sse.push(decoder.decode()), ...sse.flush()]) {
      if (consume(data)) return accumulator.result();
    }
    if (!accumulator.hasOutput()) {
      throw createProviderTransportError(new Error('Provider stream closed before returning any content.'));
    }
    return accumulator.result('stream_closed');
  }

  private async fetchCompletion(
    settings: AgentProviderSettings,
    messages: ChatMessage[],
    tools: AgentToolDefinition[],
    headers: Record<string, string>,
    signal: AbortSignal | undefined,
    includeUsage: boolean,
  ) {
    try {
      return await fetch(this.buildEndpoint(settings.baseUrl, 'chat/completions'), {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify({
          model: settings.model,
          messages,
          ...(tools.length > 0 ? { tools: toProviderToolDefinitions(tools), tool_choice: 'auto' } : {}),
          stream: true,
          ...(includeUsage ? { stream_options: { include_usage: true } } : {}),
          max_tokens: getResponseTokenLimit(settings.contextWindow),
        }),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw createProviderTransportError(error);
    }
  }

  private buildEndpoint(baseUrl: string, endpoint: string) {
    return new URL(endpoint, `${baseUrl.replace(/\/$/, '')}/`).toString();
  }
}
