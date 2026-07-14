import { describe, expect, it } from 'vitest';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import { AiProviderRequestError } from '../../domain/entities/modelRequest.js';
import { ResilientModelRequester } from './ResilientModelRequester.js';

const sink = {
  emitChunk: () => undefined,
  emitAction: () => undefined,
  emitDone: () => undefined,
  emitError: () => undefined,
};

const input = {
  settings: { baseUrl: 'https://provider.invalid/v1', apiKey: '', model: 'primary', permissionMode: 'workspace-write' as const },
  messages: [],
  tools: [],
  eventSink: sink,
  requestId: 'request-1',
};

describe('ResilientModelRequester', () => {
  it('retries a transient pre-stream failure and returns the successful attempt', async () => {
    let calls = 0;
    const provider: IAiProvider = { requestAssistantMessage: async () => {
      calls += 1;
      if (calls === 1) throw new AiProviderRequestError('rate_limit', 'retry', { retryAfterMs: 10 });
      return { role: 'assistant', content: 'ok' };
    } };
    const delays: number[] = [];
    const requester = new ResilientModelRequester(provider, async (milliseconds) => { delays.push(milliseconds); });
    const result = await requester.execute({ ...input, settings: { ...input.settings, retryCount: 1 } });
    expect(result).toMatchObject({ model: 'primary', attemptCount: 2, response: { content: 'ok' } });
    expect(delays).toEqual([10]);
  });

  it('moves to an explicit fallback model after primary attempts are exhausted', async () => {
    const models: string[] = [];
    const provider: IAiProvider = { requestAssistantMessage: async (settings) => {
      models.push(settings.model);
      if (settings.model === 'primary') throw new AiProviderRequestError('overloaded', 'busy');
      return { role: 'assistant', content: 'fallback ok' };
    } };
    const requester = new ResilientModelRequester(provider, async () => undefined);
    const result = await requester.execute({ ...input, settings: { ...input.settings, retryCount: 1, fallbackModels: ['fallback'] } });
    expect(models).toEqual(['primary', 'primary', 'fallback']);
    expect(result).toMatchObject({ model: 'fallback', attemptCount: 3 });
  });

  it('does not retry after an attempt has emitted visible content', async () => {
    let calls = 0;
    const provider: IAiProvider = { requestAssistantMessage: async (_settings, _messages, _tools, eventSink, requestId) => {
      calls += 1;
      eventSink.emitChunk(requestId, 'partial');
      throw new AiProviderRequestError('network', 'connection reset');
    } };
    const requester = new ResilientModelRequester(provider, async () => undefined);
    await expect(requester.execute({ ...input, settings: { ...input.settings, retryCount: 2 } })).rejects.toThrow('connection reset');
    expect(calls).toBe(1);
  });

  it('turns an exceeded deadline into a retryable timeout', async () => {
    let calls = 0;
    const provider: IAiProvider = { requestAssistantMessage: async (_settings, _messages, _tools, _eventSink, _requestId, signal) => {
      calls += 1;
      if (calls > 1) return { role: 'assistant', content: 'recovered' };
      return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(signal.reason), { once: true }));
    } };
    const requester = new ResilientModelRequester(provider, async () => undefined);
    const result = await requester.execute({ ...input, settings: { ...input.settings, retryCount: 1, requestTimeoutMs: 5 } });
    expect(result.response.content).toBe('recovered');
    expect(calls).toBe(2);
  });
});
