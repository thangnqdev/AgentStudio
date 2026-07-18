import { describe, expect, it } from 'vitest';
import { WebPreparedContentCache } from './WebPreparedContentCache.js';

describe('WebPreparedContentCache', () => {
  it('expires entries and evicts least-recently-used content within the byte budget', () => {
    let now = 0;
    const cache = new WebPreparedContentCache(100, 6, () => now);
    cache.set('a', content('aaa'));
    cache.set('b', content('bbb'));
    expect(cache.get('a')?.content).toBe('aaa');
    cache.set('c', content('cccc'));
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')?.content).toBe('cccc');
    now = 101;
    expect(cache.get('c')).toBeUndefined();
  });

  it('reuses prepared binary metadata without repeating persistence work', () => {
    const cache = new WebPreparedContentCache();
    const value = { ...content('binary'), persisted: { path: '/private/file.pdf', size: 6 } };
    cache.set('https://example.com/file.pdf', value);
    expect(cache.get('https://example.com/file.pdf')).toBe(value);
  });
});

function content(value: string) {
  return { bytes: value.length, code: 200, codeText: 'OK', content: value, contentType: 'text/plain' };
}
