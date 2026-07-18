import type { WebPageFetchResult } from '../entities/webFetch.js';

export interface IWebPageFetcher {
  fetch(url: string, signal?: AbortSignal): Promise<WebPageFetchResult>;
}
