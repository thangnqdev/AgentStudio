import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpProviderModelCatalog } from './HttpProviderModelCatalog.js';

describe('HttpProviderModelCatalog', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('normalizes models returned in an OpenAI-style data field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 'model-a', context_window: 32_000 }],
    }), { status: 200 })));

    const models = await new HttpProviderModelCatalog().listModels('http://localhost:20128/v1', 'secret');

    expect(models).toEqual([{ id: 'model-a', contextWindow: 32_000 }]);
    expect(fetch).toHaveBeenCalledWith(new URL('http://localhost:20128/v1/models'), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
    }));
  });

  it('aborts a model request after the configured timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));

    const result = new HttpProviderModelCatalog(1_000).listModels('http://localhost:20128/v1', '');
    const rejection = expect(result).rejects.toThrow('Provider không phản hồi trong vòng 1 giây.');
    await vi.advanceTimersByTimeAsync(1_000);

    await rejection;
  });
});
