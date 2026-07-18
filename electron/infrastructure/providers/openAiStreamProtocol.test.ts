import { describe, expect, it } from 'vitest';
import { OpenAiChatStreamAccumulator, SseDataDecoder, readOpenAiUsage } from './openAiStreamProtocol.js';

describe('SseDataDecoder', () => {
  it('accepts optional data spacing, CRLF, arbitrary chunks and a final unterminated event', () => {
    const decoder = new SseDataDecoder();
    expect(decoder.push('event: message\r\ndata:{"a":')).toEqual([]);
    expect(decoder.push('1}\r\ndata: {"b":2}\r\n')).toEqual(['{"a":1}', '{"b":2}']);
    expect(decoder.push('data:[DONE]')).toEqual([]);
    expect(decoder.flush()).toEqual(['[DONE]']);
  });
});

describe('OpenAiChatStreamAccumulator', () => {
  it('normalizes cumulative content arrays and fragmented/index-less tool-call deltas', () => {
    const accumulator = new OpenAiChatStreamAccumulator();
    expect(accumulator.consumeData(JSON.stringify({ choices: [{ delta: {
      content: 'Hel', tool_calls: [{ index: 0, id: 'call-1', function: { name: 'read_', arguments: '{"path":"' } }],
    } }] })).contentDelta).toBe('Hel');
    expect(accumulator.consumeData(JSON.stringify({ choices: [{ delta: {
      content: [{ type: 'text', text: 'Hello' }],
      tool_calls: [{ id: 'call-1', function: { name: 'read_file', arguments: '{"path":"a"}' } }],
    }, finish_reason: 'tool_calls' }] })).contentDelta).toBe('lo');

    expect(accumulator.result()).toMatchObject({
      content: 'Hello', finishReason: 'tool_calls',
      tool_calls: [{ id: 'call-1', function: { name: 'read_file', arguments: '{"path":"a"}' } }],
    });
  });

  it('recognizes the terminal marker without trying to parse it as JSON', () => {
    expect(new OpenAiChatStreamAccumulator().consumeData('[DONE]')).toEqual({ done: true, contentDelta: '' });
  });

  it('keeps distinct index-less tool calls separated by provider IDs', () => {
    const accumulator = new OpenAiChatStreamAccumulator();
    accumulator.consumeData(JSON.stringify({ choices: [{ delta: { tool_calls: [
      { id: 'call-1', function: { name: 'Read', arguments: '{}' } },
      { id: 'call-2', function: { name: 'Grep', arguments: '{}' } },
    ] } }] }));
    expect(accumulator.result().tool_calls?.map((call) => call.id)).toEqual(['call-1', 'call-2']);
  });
});

describe('readOpenAiUsage', () => {
  it('normalizes OpenAI cached prompt tokens', () => {
    expect(readOpenAiUsage({ usage: {
      prompt_tokens: 12, completion_tokens: 3, total_tokens: 15,
      prompt_tokens_details: { cached_tokens: 4 },
    } })).toEqual({ inputTokens: 12, outputTokens: 3, totalTokens: 15, cachedInputTokens: 4 });
  });

  it('normalizes split cache-read/cache-creation counters from compatible gateways', () => {
    expect(readOpenAiUsage({ usage: {
      input_tokens: 2, output_tokens: 4, cache_read_input_tokens: 5, cache_creation_input_tokens: 3,
    } })).toEqual({
      inputTokens: 10, outputTokens: 4, totalTokens: 14,
      cachedInputTokens: 5, cacheCreationInputTokens: 3,
    });
  });
});
