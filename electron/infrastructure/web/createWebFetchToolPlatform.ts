import path from 'node:path';
import type { AgentProviderSettings } from '../../domain/entities/agent.js';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import { ModelWebContentAnalyzer } from '../../application/services/ModelWebContentAnalyzer.js';
import { WebFetchToolPlatform } from '../../application/services/WebFetchToolPlatform.js';
import { FetchWebContent } from '../../application/usecases/FetchWebContent.js';
import { WebPreparedContentCache } from '../../application/services/WebPreparedContentCache.js';
import { PrivateWebFetchBinaryStore } from './PrivateWebFetchBinaryStore.js';
import { SecureNodeWebPageFetcher } from './SecureNodeWebPageFetcher.js';
import { TurndownHtmlToMarkdownConverter } from './TurndownHtmlToMarkdownConverter.js';

const SHARED_FETCHER = new SecureNodeWebPageFetcher();
const SHARED_CONVERTER = new TurndownHtmlToMarkdownConverter();
const SHARED_CACHE = new WebPreparedContentCache();

export function createWebFetchToolPlatform(input: {
  baseCatalog: IToolCatalog;
  baseExecutor: IToolExecutor;
  provider: IAiProvider;
  settings: AgentProviderSettings;
  userDataDirectory: () => string;
}) {
  const useCase = new FetchWebContent(
    SHARED_FETCHER,
    SHARED_CONVERTER,
    new ModelWebContentAnalyzer(input.provider, input.settings),
    new PrivateWebFetchBinaryStore(() => path.join(input.userDataDirectory(), 'web-fetch-content')),
    Date.now,
    SHARED_CACHE,
  );
  return new WebFetchToolPlatform(input.baseCatalog, input.baseExecutor, useCase);
}
