import {
  isBinaryWebContent,
  WEB_FETCH_MAX_MARKDOWN_LENGTH,
  WEB_FETCH_MAX_RESULT_LENGTH,
  type WebFetchInput,
  type WebFetchResponse,
} from '../../domain/entities/webFetch.js';
import { isPreapprovedWebFetchUrl } from '../../domain/entities/webFetchPreapproved.js';
import type { IHtmlToMarkdownConverter } from '../../domain/ports/IHtmlToMarkdownConverter.js';
import type { IWebBinaryStore } from '../../domain/ports/IWebBinaryStore.js';
import type { IWebContentAnalyzer } from '../../domain/ports/IWebContentAnalyzer.js';
import type { IWebPageFetcher } from '../../domain/ports/IWebPageFetcher.js';
import { formatCrossHostRedirect } from '../services/webFetchInput.js';
import { WebPreparedContentCache, type PreparedWebContent } from '../services/WebPreparedContentCache.js';

export class FetchWebContent {
  private readonly fetcher: IWebPageFetcher;
  private readonly converter: IHtmlToMarkdownConverter;
  private readonly analyzer: IWebContentAnalyzer;
  private readonly binaryStore: IWebBinaryStore;
  private readonly cache?: WebPreparedContentCache;
  private readonly now: () => number;

  constructor(
    fetcher: IWebPageFetcher,
    converter: IHtmlToMarkdownConverter,
    analyzer: IWebContentAnalyzer,
    binaryStore: IWebBinaryStore,
    now = Date.now,
    cache?: WebPreparedContentCache,
  ) {
    this.fetcher = fetcher;
    this.converter = converter;
    this.analyzer = analyzer;
    this.binaryStore = binaryStore;
    this.now = now;
    this.cache = cache;
  }

  async execute(input: WebFetchInput, signal?: AbortSignal): Promise<WebFetchResponse> {
    const startedAt = this.now();
    const cached = this.cache?.get(input.url);
    const response = cached ? undefined : await this.fetcher.fetch(input.url, signal);
    if (response?.type === 'redirect') {
      const result = formatCrossHostRedirect({ ...response, prompt: input.prompt });
      return {
        bytes: new TextEncoder().encode(result).byteLength,
        code: response.code,
        codeText: response.codeText,
        result,
        durationMs: Math.max(0, this.now() - startedAt),
        url: input.url,
      };
    }
    if (!cached && !response) throw new Error('WebFetch cache invariant failed.');
    const prepared = cached ?? await this.prepare(input.url, response as Extract<NonNullable<typeof response>, { type: 'content' }>);
    const { bytes, code, codeText, content, contentType, persisted } = prepared;
    const preapproved = isPreapprovedWebFetchUrl(input.url);
    let result = preapproved
      && contentType.toLowerCase().includes('text/markdown')
      && content.length < WEB_FETCH_MAX_MARKDOWN_LENGTH
      ? content
      : await this.analyzer.analyze({ url: input.url, content, prompt: input.prompt, preapproved }, signal);

    const binaryNote = persisted
      ? `\n\n[Binary content (${contentType}, ${persisted.size} bytes) also saved to ${persisted.path}]`
      : '';
    result = `${boundResult(result, WEB_FETCH_MAX_RESULT_LENGTH - binaryNote.length)}${binaryNote}`;

    return {
      bytes,
      code,
      codeText,
      result,
      durationMs: Math.max(0, this.now() - startedAt),
      url: input.url,
    };
  }

  private async prepare(url: string, response: Extract<Awaited<ReturnType<IWebPageFetcher['fetch']>>, { type: 'content' }>) {
    const persisted = isBinaryWebContent(response.contentType)
      ? await this.binaryStore.persist({ body: response.body, contentType: response.contentType }).catch(() => undefined)
      : undefined;
    const decoded = new TextDecoder().decode(response.body);
    const content = response.contentType.toLowerCase().includes('text/html')
      ? await this.converter.convert(decoded)
      : decoded;
    const prepared: PreparedWebContent = {
      bytes: response.body.byteLength,
      code: response.code,
      codeText: response.codeText,
      content,
      contentType: response.contentType,
      ...(persisted ? { persisted } : {}),
    };
    this.cache?.set(url, prepared);
    return prepared;
  }
}

function boundResult(result: string, maxLength: number) {
  const marker = '\n\n[WebFetch result truncated due to length.]';
  const limit = Math.max(0, maxLength);
  if (result.length <= limit) return result;
  return `${result.slice(0, Math.max(0, limit - marker.length))}${marker.slice(0, limit)}`;
}
