import type { WebSearchProvider, WebSearchSettings } from '../../domain/entities/webSearch.js';

export function validateWebSearchSettings(input: WebSearchSettings, hasExistingKey = false): WebSearchSettings {
  const provider = normalizeProvider(input.provider);
  const baseUrl = normalizeUrl(input.baseUrl);
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
  const model = typeof input.model === 'string' ? input.model.trim().slice(0, 120) : '';

  if (provider === 'searxng' && !baseUrl) throw new Error('SearXNG requires the URL of your instance.');
  if ((provider === 'openai' || provider === 'tavily') && !apiKey && !hasExistingKey) throw new Error(`${provider === 'openai' ? 'OpenAI' : 'Tavily'} requires an API key.`);
  return { provider, baseUrl, apiKey, model };
}

function normalizeProvider(value: unknown): WebSearchProvider {
  if (value === 'openai' || value === 'tavily' || value === 'searxng' || value === 'disabled') return value;
  throw new Error('Unsupported web search connector.');
}

function normalizeUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const url = new URL(value.trim());
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Web search URL must use HTTP or HTTPS.');
  return url.toString().replace(/\/$/, '');
}
