import { describe, expect, it } from 'vitest';
import {
  isBinaryWebContent,
  isPermittedWebFetchRedirect,
  normalizeWebFetchUrl,
  WEB_FETCH_MAX_URL_LENGTH,
} from './webFetch.js';
import { isPreapprovedWebFetchUrl } from './webFetchPreapproved.js';

describe('WebFetch domain rules', () => {
  it('normalizes public HTTP URLs to HTTPS and preserves URL details', () => {
    expect(normalizeWebFetchUrl('http://example.com/docs?q=1#api')).toBe('https://example.com/docs?q=1#api');
  });

  it('rejects unsupported, credentialed, local and oversized URLs', () => {
    for (const url of ['file:///tmp/a', 'https://user:secret@example.com', 'https://localhost/private']) {
      expect(() => normalizeWebFetchUrl(url), url).toThrow();
    }
    expect(() => normalizeWebFetchUrl(`https://example.com/${'a'.repeat(WEB_FETCH_MAX_URL_LENGTH)}`)).toThrow();
  });

  it('follows only same-origin or www-equivalent redirects', () => {
    expect(isPermittedWebFetchRedirect('https://example.com/a', 'https://www.example.com/b')).toBe(true);
    expect(isPermittedWebFetchRedirect('https://example.com/a', 'https://example.com:444/b')).toBe(false);
    expect(isPermittedWebFetchRedirect('https://example.com/a', 'https://example.net/b')).toBe(false);
    expect(isPermittedWebFetchRedirect('https://example.com/a', 'http://example.com/b')).toBe(false);
  });

  it('uses segment-safe preapproval and identifies binary media', () => {
    expect(isPreapprovedWebFetchUrl('https://github.com/anthropics/claude-code')).toBe(true);
    expect(isPreapprovedWebFetchUrl('https://github.com/anthropics-evil/repo')).toBe(false);
    expect(isBinaryWebContent('application/pdf')).toBe(true);
    expect(isBinaryWebContent('application/json; charset=utf-8')).toBe(false);
    expect(isBinaryWebContent('application/atom+xml')).toBe(false);
    expect(isBinaryWebContent('application/problem+json')).toBe(false);
    expect(isBinaryWebContent('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    expect(isBinaryWebContent('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
  });
});
