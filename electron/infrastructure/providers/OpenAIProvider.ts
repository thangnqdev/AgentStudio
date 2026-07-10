import type { WebContents } from 'electron';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import type { AgentProviderSettings, AssistantResponse, ChatMessage, ToolCall } from '../../domain/entities/agent.js';

type StreamingToolCall = {
  index: number;
  id: string;
  type?: string;
  function: {
    name: string;
    arguments: string;
  };
};

const MAX_RESPONSE_TOKENS = 8_192;

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files and folders inside the current workspace.',
      parameters: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Workspace-relative directory. Defaults to current workspace root.' },
          maxEntries: { type: 'number', description: 'Maximum entries to return.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read a UTF-8 text file from the workspace.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Workspace-relative file path.' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: 'Write UTF-8 text to a workspace file. Blocked in read-only mode.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Workspace-relative file path.' },
          content: { type: 'string', description: 'Full file content to write.' },
        },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Run a shell command in the workspace. Blocked in read-only mode. Sandboxed in workspace-write mode.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Shell command to run.' },
          timeoutMs: { type: 'number', description: 'Timeout in milliseconds, max 30000.' },
        },
        required: ['command'],
      },
    },
  },
];

export class OpenAIProvider implements IAiProvider {
  async requestAssistantMessage(
    settings: AgentProviderSettings,
    messages: ChatMessage[],
    sender: WebContents,
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
        max_tokens: this.getResponseTokenLimit(settings.contextWindow),
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
          this.emitChunk(sender, requestId, contentDelta);
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

  private emitChunk(sender: WebContents, requestId: string, chunk: string) {
    if (chunk) {
      sender.send('ai:chat:chunk', { requestId, chunk });
    }
  }

  private isUsableContextWindow(value: number | undefined): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 2_048;
  }

  private getResponseTokenLimit(contextWindow: number | undefined) {
    if (!this.isUsableContextWindow(contextWindow)) return MAX_RESPONSE_TOKENS;
    return Math.min(MAX_RESPONSE_TOKENS, Math.max(1_024, Math.floor(contextWindow * 0.25)));
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
