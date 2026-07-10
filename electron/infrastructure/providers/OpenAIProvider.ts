import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import type { AgentProviderSettings, AssistantResponse, ChatMessage, ToolCall } from '../../domain/entities/agent.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import { getResponseTokenLimit } from '../../domain/entities/tokenBudget.js';
import { AGENT_TOOL_DEFINITIONS } from '../../domain/entities/tool.js';

type StreamingToolCall = {
  index: number;
  id: string;
  type?: string;
  function: {
    name: string;
    arguments: string;
  };
};


export const TOOL_DEFINITIONS = AGENT_TOOL_DEFINITIONS.map((tool) => ({
  type: 'function' as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: { type: 'object', ...tool.parameters },
  },
}));

export class OpenAIProvider implements IAiProvider {
  async requestAssistantMessage(
    settings: AgentProviderSettings,
    messages: ChatMessage[],
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

    const response = await fetch(this.buildEndpoint(settings.baseUrl, 'chat/completions'), {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        model: settings.model,
        messages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        stream: true,
        max_tokens: getResponseTokenLimit(settings.contextWindow),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body returned from the API.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const toolCalls = new Map<number, StreamingToolCall>();
    let content = '';
    let buffer = '';
    let finishReason = '';

    while (true) {
      if (signal?.aborted) throw new Error('Agent session stopped.');

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        if (trimmed === 'data: [DONE]') {
          return {
            role: 'assistant' as const,
            content,
            tool_calls: this.normalizeStreamingToolCalls(toolCalls),
            finishReason,
          };
        }

        const chunk = this.parseSseJson(trimmed.slice(6));
        if (!chunk) continue;

        finishReason = this.readChoiceFinishReason(chunk) || finishReason;
        const delta = this.readChoiceDelta(chunk);
        if (!delta) continue;

        const contentDelta = delta.content;
        if (typeof contentDelta === 'string' && contentDelta) {
          content += contentDelta;
          eventSink.emitChunk(requestId, contentDelta);
        }

        const toolCallDeltas = delta.tool_calls;
        if (Array.isArray(toolCallDeltas)) {
          this.mergeToolCallDeltas(toolCalls, toolCallDeltas);
        }
      }
    }

    return {
      role: 'assistant' as const,
      content,
      tool_calls: this.normalizeStreamingToolCalls(toolCalls),
      finishReason: finishReason || 'stream_closed',
    };
  }

  private buildEndpoint(baseUrl: string, endpoint: string) {
    return new URL(endpoint, `${baseUrl.replace(/\/$/, '')}/`).toString();
  }



  private parseSseJson(raw: string): unknown | null {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private readChoiceDelta(chunk: unknown): Record<string, unknown> | null {
    if (!this.isObject(chunk) || !Array.isArray(chunk.choices)) return null;
    const choice = chunk.choices[0];
    if (!this.isObject(choice) || !this.isObject(choice.delta)) return null;
    return choice.delta;
  }

  private readChoiceFinishReason(chunk: unknown): string {
    if (!this.isObject(chunk) || !Array.isArray(chunk.choices)) return '';
    const choice = chunk.choices[0];
    if (!this.isObject(choice)) return '';
    return typeof choice.finish_reason === 'string' ? choice.finish_reason : '';
  }

  private mergeToolCallDeltas(toolCalls: Map<number, StreamingToolCall>, deltas: unknown[]) {
    for (const rawDelta of deltas) {
      if (!this.isObject(rawDelta)) continue;

      const index = typeof rawDelta.index === 'number' ? rawDelta.index : toolCalls.size;
      const existing = toolCalls.get(index) ?? {
        index,
        id: '',
        function: {
          name: '',
          arguments: '',
        },
      };

      if (typeof rawDelta.id === 'string') {
        existing.id = rawDelta.id;
      }
      if (typeof rawDelta.type === 'string') {
        existing.type = rawDelta.type;
      }
      if (this.isObject(rawDelta.function)) {
        if (typeof rawDelta.function.name === 'string') {
          existing.function.name += rawDelta.function.name;
        }
        if (typeof rawDelta.function.arguments === 'string') {
          existing.function.arguments += rawDelta.function.arguments;
        }
      }

      toolCalls.set(index, existing);
    }
  }

  private normalizeStreamingToolCalls(toolCalls: Map<number, StreamingToolCall>): ToolCall[] {
    return [...toolCalls.values()]
      .sort((left, right) => left.index - right.index)
      .filter((toolCall) => toolCall.function.name)
      .map((toolCall) => ({
        id: toolCall.id || `tool-${toolCall.index}`,
        type: toolCall.type || 'function',
        function: {
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        },
      }));
  }
}
