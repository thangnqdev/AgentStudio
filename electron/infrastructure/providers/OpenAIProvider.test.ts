import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentToolExecutor } from '../tools/AgentToolExecutor.js';
import { OpenAIProvider } from './OpenAIProvider.js';

afterEach(() => vi.unstubAllGlobals());

describe('OpenAIProvider tool capabilities', () => {
  it('exposes web search only when its independent connector is enabled', async () => {
    expect((await new AgentToolExecutor({ provider: 'openai' }).list('/workspace')).some((tool) => tool.name === 'web_search')).toBe(true);
    expect((await new AgentToolExecutor({ provider: 'disabled' }).list('/workspace')).some((tool) => tool.name === 'web_search')).toBe(false);
  });
});

describe('OpenAIProvider usage', () => {
  it('requests and normalizes bounded streaming token usage', async () => {
    const fetchMock = vi.fn(async (_input: unknown, _init?: RequestInit) => new Response([
      'data: {"choices":[{"delta":{"content":"hello"},"finish_reason":"stop"}]}',
      'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15,"prompt_tokens_details":{"cached_tokens":4}}}',
      'data: [DONE]',
      '',
    ].join('\n')));
    vi.stubGlobal('fetch', fetchMock);
    const response = await new OpenAIProvider().requestAssistantMessage(settings(), [], [], sink(), 'request-1');
    expect(response.usage).toEqual({ inputTokens: 12, outputTokens: 3, totalTokens: 15, cachedInputTokens: 4 });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ stream_options: { include_usage: true } });
  });

  it('retries once without stream_options when a compatible provider rejects it', async () => {
    const fetchMock = vi.fn(async (_input: unknown, _init?: RequestInit): Promise<Response> => new Response())
      .mockResolvedValueOnce(new Response('{"error":"unknown stream_options"}', { status: 400 }))
      .mockResolvedValueOnce(new Response('data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\ndata: [DONE]\n'));
    vi.stubGlobal('fetch', fetchMock);
    const response = await new OpenAIProvider().requestAssistantMessage(settings(), [], [], sink(), 'request-2');
    expect(response.content).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).not.toHaveProperty('stream_options');
  });
});

function settings() {
  return { baseUrl: 'http://localhost:20128/v1', apiKey: '', model: 'test-model', permissionMode: 'read-only' as const };
}

function sink() {
  return { emitChunk: () => undefined, emitAction: () => undefined, emitDone: () => undefined, emitError: () => undefined };
}
