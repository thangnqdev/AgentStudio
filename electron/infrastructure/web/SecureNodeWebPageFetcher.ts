import http, { type IncomingMessage } from 'node:http';
import https from 'node:https';
import {
  isPermittedWebFetchRedirect,
  normalizeWebFetchUrl,
  WEB_FETCH_MAX_CONTENT_BYTES,
  WEB_FETCH_MAX_REDIRECTS,
  WEB_FETCH_TIMEOUT_MS,
  type WebPageFetchResult,
} from '../../domain/entities/webFetch.js';
import type { IWebPageFetcher } from '../../domain/ports/IWebPageFetcher.js';
import { resolvePublicWebAddress, type PublicWebAddress, type WebHostResolver } from './webFetchNetworkPolicy.js';

const REDIRECT_CODES = new Set([301, 302, 307, 308]);
const USER_AGENT = 'AgentStudio-WebFetch/1.0 (+https://github.com/thangnqdev/AgentStudio)';
export type WebHttpRequester = (url: URL, address: PublicWebAddress, signal: AbortSignal) => Promise<IncomingMessage>;

export class SecureNodeWebPageFetcher implements IWebPageFetcher {
  private readonly resolver?: WebHostResolver;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private readonly maxRedirects: number;
  private readonly requester: WebHttpRequester;

  constructor(options: {
    resolver?: WebHostResolver;
    timeoutMs?: number;
    maxBytes?: number;
    maxRedirects?: number;
    requester?: WebHttpRequester;
  } = {}) {
    this.resolver = options.resolver;
    this.timeoutMs = options.timeoutMs ?? WEB_FETCH_TIMEOUT_MS;
    this.maxBytes = options.maxBytes ?? WEB_FETCH_MAX_CONTENT_BYTES;
    this.maxRedirects = options.maxRedirects ?? WEB_FETCH_MAX_REDIRECTS;
    this.requester = options.requester ?? requestWithNode;
  }

  async fetch(rawUrl: string, signal?: AbortSignal): Promise<WebPageFetchResult> {
    const deadline = createDeadline(signal, this.timeoutMs);
    try {
      let currentUrl = normalizeWebFetchUrl(rawUrl);
      for (let redirects = 0; ; redirects += 1) {
        const response = await this.request(currentUrl, deadline.signal);
        if (!REDIRECT_CODES.has(response.statusCode ?? 0)) return await this.readContent(currentUrl, response, deadline.signal);
        const location = response.headers.location;
        response.destroy();
        if (!location) throw new Error('WebFetch redirect is missing a Location header.');
        const redirectUrl = validateRedirectLocation(location, currentUrl);
        const code = response.statusCode ?? 302;
        const codeText = response.statusMessage || redirectStatusText(code);
        if (!isPermittedWebFetchRedirect(currentUrl, redirectUrl)) {
          return { type: 'redirect', originalUrl: currentUrl, redirectUrl, code, codeText };
        }
        if (redirects >= this.maxRedirects) throw new Error(`Too many redirects (exceeded ${this.maxRedirects}).`);
        currentUrl = redirectUrl;
      }
    } catch (error) {
      if (deadline.didTimeout()) throw new Error(`WebFetch timed out after ${this.timeoutMs}ms.`, { cause: error });
      if (signal?.aborted) throw new Error('Agent session stopped.', { cause: error });
      throw error;
    } finally {
      deadline.dispose();
    }
  }

  private async request(rawUrl: string, signal: AbortSignal) {
    const url = new URL(rawUrl);
    const address = await resolvePublicWebAddress(url.hostname, this.resolver, signal);
    return this.requester(url, address, signal);
  }

  private async readContent(url: string, response: IncomingMessage, signal: AbortSignal): Promise<WebPageFetchResult> {
    const code = response.statusCode ?? 0;
    const codeText = response.statusMessage || http.STATUS_CODES[code] || '';
    if (code < 200 || code >= 300) {
      response.destroy();
      throw new Error(`WebFetch request failed with ${code} ${codeText}.`);
    }
    const declaredSize = Number(response.headers['content-length']);
    if (Number.isFinite(declaredSize) && declaredSize > this.maxBytes) {
      response.destroy();
      throw new Error(`WebFetch response exceeds the ${this.maxBytes}-byte limit.`);
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const rawChunk of response) {
      if (signal.aborted) throw new Error('Agent session stopped.');
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
      bytes += chunk.length;
      if (bytes > this.maxBytes) {
        response.destroy();
        throw new Error(`WebFetch response exceeds the ${this.maxBytes}-byte limit.`);
      }
      chunks.push(chunk);
    }
    return {
      type: 'content', url, code, codeText,
      contentType: String(response.headers['content-type'] ?? ''),
      body: Buffer.concat(chunks, bytes),
    };
  }
}

async function requestWithNode(url: URL, address: PublicWebAddress, signal: AbortSignal) {
  const client = url.protocol === 'https:' ? https : http;
  return await new Promise<IncomingMessage>((resolve, reject) => {
    const request = client.request(url, {
      method: 'GET',
      signal,
      servername: url.hostname,
      headers: {
        Accept: 'text/markdown, text/html, */*',
        'Accept-Encoding': 'identity',
        'User-Agent': USER_AGENT,
      },
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
    }, resolve);
    request.once('error', reject);
    request.end();
  });
}

function validateRedirectLocation(location: string, currentUrl: string) {
  let redirect: URL;
  try {
    redirect = new URL(location, currentUrl);
  } catch {
    throw new Error('WebFetch received an invalid redirect URL.');
  }
  if (!['http:', 'https:'].includes(redirect.protocol) || redirect.username || redirect.password) {
    throw new Error('WebFetch blocked an unsafe redirect URL.');
  }
  return redirect.toString();
}

function createDeadline(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const stop = () => controller.abort(parent?.reason);
  if (parent?.aborted) stop();
  else parent?.addEventListener('abort', stop, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(new Error('WebFetch timeout.')); }, timeoutMs);
  return {
    signal: controller.signal,
    dispose: () => { clearTimeout(timer); parent?.removeEventListener('abort', stop); },
    didTimeout: () => timedOut,
  };
}

function redirectStatusText(code: number) {
  return http.STATUS_CODES[code] || 'Redirect';
}
