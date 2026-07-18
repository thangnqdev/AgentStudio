import { describe, expect, it } from 'vitest';
import { FetchWebContent } from '../usecases/FetchWebContent.js';
import { WebFetchToolPlatform } from './WebFetchToolPlatform.js';

describe('WebFetchToolPlatform', () => {
  it('maps the structured response to result text for the model-facing tool message', async () => {
    const base = {
      list: async () => [],
      execute: async () => ({ ok: false, output: 'unused' }),
    };
    const fetchContent = new FetchWebContent(
      { fetch: async (url) => ({
        type: 'content' as const,
        url,
        code: 200,
        codeText: 'OK',
        contentType: 'text/plain',
        body: new TextEncoder().encode('page body'),
      }) },
      { convert: async (html) => html },
      { analyze: async () => 'focused answer' },
      { persist: async () => ({ path: '/private/unused', size: 0 }) },
      () => 10,
    );
    const platform = new WebFetchToolPlatform(base, base, fetchContent);

    await expect(platform.execute(
      'WebFetch',
      { url: 'https://example.com/docs', prompt: 'Extract the answer' },
      '/workspace',
      'read-only',
    )).resolves.toEqual({ ok: true, output: 'focused answer' });
  });
});
