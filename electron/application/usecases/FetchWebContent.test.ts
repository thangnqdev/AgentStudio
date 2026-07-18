import { describe, expect, it, vi } from 'vitest';
import type { WebPageFetchResult } from '../../domain/entities/webFetch.js';
import { WebPreparedContentCache } from '../services/WebPreparedContentCache.js';
import { FetchWebContent } from './FetchWebContent.js';

describe('FetchWebContent', () => {
  it('returns short preapproved Markdown without a secondary model call', async () => {
    const analyzer = { analyze: vi.fn(async () => 'analyzed') };
    const useCase = createUseCase(content('text/markdown', '# Python docs'), analyzer);
    const result = await useCase.execute({ url: 'https://docs.python.org/3/', prompt: 'Summarize' });
    expect(result).toMatchObject({ code: 200, codeText: 'OK', result: '# Python docs', url: 'https://docs.python.org/3/' });
    expect(analyzer.analyze).not.toHaveBeenCalled();
  });

  it('converts HTML and sends untrusted pages through the bounded analyzer', async () => {
    const analyzer = { analyze: vi.fn(async () => 'extracted result') };
    const converter = { convert: vi.fn(async () => '# Converted') };
    const useCase = createUseCase(content('text/html; charset=utf-8', '<h1>Converted</h1>'), analyzer, converter);
    const result = await useCase.execute({ url: 'https://example.com/article', prompt: 'Extract title' });
    expect(result.result).toBe('extracted result');
    expect(converter.convert).toHaveBeenCalledWith('<h1>Converted</h1>');
    expect(analyzer.analyze).toHaveBeenCalledWith({
      url: 'https://example.com/article', content: '# Converted', prompt: 'Extract title', preapproved: false,
    }, undefined);
  });

  it('returns a separate-call instruction for cross-host redirects', async () => {
    const redirect: WebPageFetchResult = {
      type: 'redirect', originalUrl: 'https://example.com/a', redirectUrl: 'https://cdn.example.net/b', code: 302, codeText: 'Found',
    };
    const result = await createUseCase(redirect).execute({ url: 'https://example.com/a', prompt: 'Read page' });
    expect(result.result).toContain('REDIRECT DETECTED');
    expect(result.result).toContain('https://cdn.example.net/b');
    expect(result.code).toBe(302);
  });

  it('bounds secondary-model output before returning it to the agent loop', async () => {
    const useCase = createUseCase(content('text/plain', 'source'), { analyze: async () => 'x'.repeat(100_001) });
    const result = await useCase.execute({ url: 'https://example.com', prompt: 'Extract' });
    expect(result.result).toHaveLength(100_000);
    expect(result.result.endsWith('[WebFetch result truncated due to length.]')).toBe(true);
  });

  it('retains binary metadata without exceeding the final result bound', async () => {
    const useCase = createUseCase(
      content('application/pdf', '%PDF'),
      { analyze: async () => 'x'.repeat(100_001) },
      undefined,
      { persist: async () => ({ path: '/private/web-fetch/file.pdf', size: 4 }) },
    );
    const result = await useCase.execute({ url: 'https://example.com/file.pdf', prompt: 'Extract' });
    expect(result.result).toHaveLength(100_000);
    expect(result.result).toContain('[WebFetch result truncated due to length.]');
    expect(result.result.endsWith('also saved to /private/web-fetch/file.pdf]')).toBe(true);
  });

  it('caches converted content and binary persistence across prompts', async () => {
    const fetcher = { fetch: vi.fn(async () => content('application/pdf', '<html>binary</html>')) };
    const converter = { convert: vi.fn(async () => '# converted') };
    const analyzer = { analyze: vi.fn(async ({ prompt }: { prompt: string }) => `answer:${prompt}`) };
    const store = { persist: vi.fn(async () => ({ path: '/private/file.pdf', size: 19 })) };
    const useCase = new FetchWebContent(fetcher, converter, analyzer, store, () => 100, new WebPreparedContentCache());
    await useCase.execute({ url: 'https://example.com/file.pdf', prompt: 'first' });
    await useCase.execute({ url: 'https://example.com/file.pdf', prompt: 'second' });
    expect(fetcher.fetch).toHaveBeenCalledOnce();
    expect(store.persist).toHaveBeenCalledOnce();
    expect(analyzer.analyze).toHaveBeenCalledTimes(2);
  });

  it('persists binary content outside the workspace and retains the metadata', async () => {
    const store = { persist: vi.fn(async () => ({ path: '/private/web-fetch/file.pdf', size: 4 })) };
    const useCase = createUseCase(content('application/pdf', '%PDF'), { analyze: async () => 'PDF summary' }, undefined, store);
    const result = await useCase.execute({ url: 'https://example.com/file.pdf', prompt: 'Summarize' });
    expect(result.result).toContain('PDF summary');
    expect(result.result).toContain('/private/web-fetch/file.pdf');
    expect(store.persist).toHaveBeenCalledOnce();
  });

  it('persists binary content before secondary analysis so the raw response survives analyzer failure', async () => {
    const store = { persist: vi.fn(async () => ({ path: '/private/web-fetch/file.pdf', size: 4 })) };
    const useCase = createUseCase(
      content('application/pdf', '%PDF'),
      { analyze: async () => { throw new Error('analyzer failed'); } },
      undefined,
      store,
    );
    await expect(useCase.execute({ url: 'https://example.com/file.pdf', prompt: 'Summarize' }))
      .rejects.toThrow('analyzer failed');
    expect(store.persist).toHaveBeenCalledOnce();
  });
});

function content(contentType: string, body: string): WebPageFetchResult {
  return { type: 'content', url: 'https://example.com', code: 200, codeText: 'OK', contentType, body: new TextEncoder().encode(body) };
}

function createUseCase(
  result: WebPageFetchResult,
  analyzer = { analyze: async ({ content }: { content: string }) => content },
  converter = { convert: async (html: string) => html },
  store = { persist: async ({ body }: { body: Uint8Array }) => ({ path: '/private/file.bin', size: body.byteLength }) },
) {
  return new FetchWebContent({ fetch: async () => result }, converter, analyzer, store, () => 100);
}
