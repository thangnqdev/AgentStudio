import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { SecureNodeWebPageFetcher, type WebHttpRequester } from './SecureNodeWebPageFetcher.js';

const resolver = async () => [{ address: '93.184.216.34', family: 4 as const }];

describe('SecureNodeWebPageFetcher', () => {
  it('pins the approved DNS address and follows only same-host redirects', async () => {
    const seen: Array<{ url: string; address: string }> = [];
    const responses = [
      response(302, { location: '/next' }),
      response(200, { 'content-type': 'text/plain' }, ['done']),
    ];
    const requester: WebHttpRequester = async (url, address) => {
      seen.push({ url: url.toString(), address: address.address });
      return responses.shift()!;
    };
    const result = await new SecureNodeWebPageFetcher({ resolver, requester }).fetch('https://example.com/start');
    expect(result).toMatchObject({ type: 'content', url: 'https://example.com/next', code: 200 });
    expect(seen).toEqual([
      { url: 'https://example.com/start', address: '93.184.216.34' },
      { url: 'https://example.com/next', address: '93.184.216.34' },
    ]);
  });

  it('returns cross-host redirects without consuming their response body', async () => {
    const redirected = response(302, { location: 'https://cdn.example.net/file' }, ['unbounded body']);
    const destroy = vi.spyOn(redirected, 'destroy');
    const result = await fetchWith(redirected);
    expect(result).toMatchObject({ type: 'redirect', redirectUrl: 'https://cdn.example.net/file' });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('destroys malformed redirect and non-success responses', async () => {
    for (const message of [response(302), response(404, {}, ['endless error'])]) {
      const destroy = vi.spyOn(message, 'destroy');
      await expect(fetchWith(message)).rejects.toThrow();
      expect(destroy).toHaveBeenCalledOnce();
    }
  });

  it('rejects declared and streaming bodies beyond the byte limit', async () => {
    const declared = response(200, { 'content-length': '5' }, ['12345']);
    const streamed = response(200, {}, ['123', '456']);
    for (const message of [declared, streamed]) {
      const destroy = vi.spyOn(message, 'destroy');
      await expect(fetchWith(message, { maxBytes: 4 })).rejects.toThrow('exceeds');
      expect(destroy).toHaveBeenCalled();
    }
  });

  it('aborts a request that does not return headers before the deadline', async () => {
    const requester: WebHttpRequester = async (_url, _address, signal) => await new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
    await expect(new SecureNodeWebPageFetcher({ resolver, requester, timeoutMs: 5 }).fetch('https://example.com'))
      .rejects.toThrow('timed out');
  });
});

async function fetchWith(message: IncomingMessage, options: { maxBytes?: number } = {}) {
  return new SecureNodeWebPageFetcher({
    resolver,
    maxBytes: options.maxBytes,
    requester: async () => message,
  }).fetch('https://example.com/start');
}

function response(statusCode: number, headers: Record<string, string> = {}, chunks: string[] = []) {
  const stream = Readable.from(chunks.map((chunk) => Buffer.from(chunk))) as IncomingMessage;
  stream.statusCode = statusCode;
  stream.statusMessage = statusCode === 200 ? 'OK' : statusCode === 404 ? 'Not Found' : 'Found';
  stream.headers = headers;
  return stream;
}
