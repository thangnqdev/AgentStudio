import type { AssistantResponse, ModelTokenUsage, ToolCall } from '../../domain/entities/agent.js';

const MAX_SSE_BUFFER_CHARS = 4_000_000;
const MAX_STREAM_CONTENT_CHARS = 2_000_000;
const MAX_TOOL_CALLS = 128;
const MAX_TOOL_ARGUMENT_CHARS = 1_000_000;

type StreamingToolCall = {
  index: number;
  id: string;
  type?: string;
  function: { name: string; arguments: string };
};

export class SseDataDecoder {
  private buffer = '';

  push(chunk: string) {
    this.buffer += chunk;
    if (this.buffer.length > MAX_SSE_BUFFER_CHARS) throw new Error('Provider SSE frame exceeded the safe buffer limit.');
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    return lines.flatMap(readDataLine);
  }

  flush() {
    const final = this.buffer;
    this.buffer = '';
    return final ? readDataLine(final) : [];
  }
}

export class OpenAiChatStreamAccumulator {
  private readonly toolCalls = new Map<number, StreamingToolCall>();
  private content = '';
  private finishReason = '';
  private usage?: ModelTokenUsage;

  consumeData(raw: string): { done: boolean; contentDelta: string } {
    if (raw.trim() === '[DONE]') return { done: true, contentDelta: '' };
    const chunk = parseJson(raw);
    if (!isObject(chunk)) return { done: false, contentDelta: '' };
    this.usage = readOpenAiUsage(chunk) ?? this.usage;
    this.finishReason = readFinishReason(chunk) || this.finishReason;
    const delta = readChoiceDelta(chunk);
    if (!delta) return { done: false, contentDelta: '' };

    const incomingContent = readContentDelta(delta.content);
    const contentDelta = this.mergeContent(incomingContent);
    if (Array.isArray(delta.tool_calls)) this.mergeToolCallDeltas(delta.tool_calls);
    return { done: false, contentDelta };
  }

  hasOutput() {
    return Boolean(this.content || this.toolCalls.size);
  }

  result(fallbackFinishReason = ''): AssistantResponse {
    return {
      role: 'assistant',
      content: this.content,
      tool_calls: normalizeToolCalls(this.toolCalls),
      finishReason: this.finishReason || fallbackFinishReason,
      ...(this.usage ? { usage: this.usage } : {}),
    };
  }

  private mergeContent(incoming: string) {
    if (!incoming) return '';
    const addition = this.content && incoming.startsWith(this.content)
      ? incoming.slice(this.content.length)
      : incoming;
    if (this.content.length + addition.length > MAX_STREAM_CONTENT_CHARS) {
      throw new Error('Provider streamed more assistant content than AgentStudio can safely retain.');
    }
    this.content += addition;
    return addition;
  }

  private mergeToolCallDeltas(deltas: unknown[]) {
    for (const rawDelta of deltas) {
      if (!isObject(rawDelta)) continue;
      const index = resolveToolIndex(rawDelta, this.toolCalls);
      const existing = this.toolCalls.get(index) ?? {
        index, id: '', function: { name: '', arguments: '' },
      };
      if (!this.toolCalls.has(index) && this.toolCalls.size >= MAX_TOOL_CALLS) {
        throw new Error('Provider streamed too many tool calls.');
      }
      if (typeof rawDelta.id === 'string') existing.id = rawDelta.id.slice(0, 512);
      if (typeof rawDelta.type === 'string') existing.type = rawDelta.type.slice(0, 64);
      if (isObject(rawDelta.function)) {
        if (typeof rawDelta.function.name === 'string') {
          existing.function.name = appendProviderDelta(existing.function.name, rawDelta.function.name, 256);
        }
        if (typeof rawDelta.function.arguments === 'string') {
          existing.function.arguments = appendProviderDelta(
            existing.function.arguments, rawDelta.function.arguments, MAX_TOOL_ARGUMENT_CHARS,
          );
        }
      }
      this.toolCalls.set(index, existing);
    }
  }
}

export function readOpenAiUsage(chunk: Record<string, unknown>): ModelTokenUsage | undefined {
  if (!isObject(chunk.usage)) return undefined;
  const usage = chunk.usage;
  const promptTokens = readTokenCount(usage.prompt_tokens);
  const directInputTokens = readTokenCount(usage.input_tokens);
  const outputTokens = readTokenCount(usage.completion_tokens) ?? readTokenCount(usage.output_tokens);
  if ((promptTokens === undefined && directInputTokens === undefined) || outputTokens === undefined) return undefined;
  const details = isObject(usage.prompt_tokens_details) ? usage.prompt_tokens_details : undefined;
  const cachedInputTokens = readTokenCount(details?.cached_tokens) ?? readTokenCount(usage.cache_read_input_tokens);
  const cacheCreationInputTokens = readTokenCount(usage.cache_creation_input_tokens);
  const directTotalInput = safeSum(directInputTokens ?? 0, cachedInputTokens ?? 0, cacheCreationInputTokens ?? 0);
  const inputTokens = promptTokens ?? directTotalInput;
  if (inputTokens === undefined) return undefined;
  const minimumTotal = safeSum(inputTokens, outputTokens);
  if (minimumTotal === undefined) return undefined;
  const totalTokens = Math.max(readTokenCount(usage.total_tokens) ?? 0, minimumTotal);
  return {
    inputTokens, outputTokens, totalTokens,
    ...(cachedInputTokens !== undefined && cachedInputTokens <= inputTokens ? { cachedInputTokens } : {}),
    ...(cacheCreationInputTokens !== undefined && cacheCreationInputTokens <= inputTokens ? { cacheCreationInputTokens } : {}),
  };
}

function readDataLine(line: string) {
  const normalized = line.trimStart().replace(/\r$/, '');
  if (!normalized.startsWith('data:')) return [];
  const value = normalized.slice(5);
  return [value.startsWith(' ') ? value.slice(1) : value];
}

function readChoiceDelta(chunk: Record<string, unknown>) {
  if (!Array.isArray(chunk.choices) || !isObject(chunk.choices[0])) return null;
  return isObject(chunk.choices[0].delta) ? chunk.choices[0].delta : null;
}

function readFinishReason(chunk: Record<string, unknown>) {
  if (!Array.isArray(chunk.choices) || !isObject(chunk.choices[0])) return '';
  return typeof chunk.choices[0].finish_reason === 'string' ? chunk.choices[0].finish_reason : '';
}

function readContentDelta(value: unknown) {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value.map((part) => isObject(part) && typeof part.text === 'string' ? part.text : '').join('');
}

function resolveToolIndex(delta: Record<string, unknown>, tools: Map<number, StreamingToolCall>) {
  if (typeof delta.index === 'number' && Number.isSafeInteger(delta.index) && delta.index >= 0 && delta.index < MAX_TOOL_CALLS) {
    return delta.index;
  }
  if (typeof delta.id === 'string') {
    const matched = [...tools.values()].find((tool) => tool.id === delta.id);
    if (matched) return matched.index;
    for (let index = 0; index < MAX_TOOL_CALLS; index += 1) if (!tools.has(index)) return index;
  }
  if (tools.size === 1) return tools.keys().next().value!;
  for (let index = 0; index < MAX_TOOL_CALLS; index += 1) if (!tools.has(index)) return index;
  return MAX_TOOL_CALLS;
}

function appendProviderDelta(existing: string, incoming: string, maximum: number) {
  const value = existing && incoming.startsWith(existing) ? incoming : existing + incoming;
  if (value.length > maximum) throw new Error('Provider tool-call delta exceeded the safe size limit.');
  return value;
}

function normalizeToolCalls(toolCalls: Map<number, StreamingToolCall>): ToolCall[] {
  return [...toolCalls.values()].sort((left, right) => left.index - right.index)
    .filter((toolCall) => toolCall.function.name)
    .map((toolCall) => ({
      id: toolCall.id || `tool-${toolCall.index}`,
      type: toolCall.type || 'function',
      function: { name: toolCall.function.name, arguments: toolCall.function.arguments },
    }));
}

function parseJson(raw: string) {
  try { return JSON.parse(raw) as unknown; } catch { return null; }
}

function readTokenCount(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function safeSum(...values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number.isSafeInteger(total) ? total : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
