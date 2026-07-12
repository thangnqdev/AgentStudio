import type { ToolResult } from '../../domain/entities/agent.js';
import type { WebSearchSettings } from '../../domain/entities/webSearch.js';

const MAX_QUERY_CHARS = 1_000;
const MAX_DOMAINS = 20;
const MAX_RESULT_CHARS = 12_000;

export class WebSearchExecutor {
  private readonly settings: WebSearchSettings;

  constructor(settings: WebSearchSettings) {
    this.settings = settings;
  }

  isEnabled() {
    return this.settings.provider !== 'disabled';
  }

  async search(args: Record<string, unknown>): Promise<ToolResult> {
    const query = readQuery(args.query);
    if (!query) return { ok: false, output: 'Web search query is empty.' };

    if (this.settings.provider === 'tavily') return this.searchTavily(query, readDomains(args.domains));
    if (this.settings.provider === 'searxng') return this.searchSearXNG(query);
    if (this.settings.provider === 'openai') return this.searchOpenAI(query, readDomains(args.domains));
    return { ok: false, output: 'Web search is not configured. Open Settings and choose a web search connector.' };
  }

  private async searchTavily(query: string, domains: string[]): Promise<ToolResult> {
    if (!this.settings.apiKey) return { ok: false, output: 'Tavily requires an API key.' };
    const response = await fetch(this.settings.baseUrl || 'https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.settings.apiKey}` },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: 6,
        include_answer: true,
        include_raw_content: false,
        ...(domains.length > 0 ? { include_domains: domains } : {}),
      }),
    });
    if (!response.ok) return errorResult('Tavily web search', response);
    const payload = await response.json() as unknown;
    return formatSearchPayload(payload, 'answer', 'results');
  }

  private async searchSearXNG(query: string): Promise<ToolResult> {
    if (!this.settings.baseUrl) return { ok: false, output: 'SearXNG requires the URL of your instance.' };
    const url = new URL('search', `${this.settings.baseUrl.replace(/\/$/, '')}/`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('categories', 'general');
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return errorResult('SearXNG web search', response);
    return formatSearchPayload(await response.json() as unknown, '', 'results');
  }

  private async searchOpenAI(query: string, domains: string[]): Promise<ToolResult> {
    if (!this.settings.apiKey) return { ok: false, output: 'OpenAI web search requires an API key.' };
    const baseUrl = this.settings.baseUrl || 'https://api.openai.com/v1';
    const response = await fetch(new URL('responses', `${baseUrl.replace(/\/$/, '')}/`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.settings.apiKey}` },
      body: JSON.stringify({
        model: this.settings.model || 'gpt-5.5',
        input: query,
        tools: [{ type: 'web_search', search_context_size: 'medium', ...(domains.length ? { filters: { allowed_domains: domains } } : {}) }],
        tool_choice: 'required',
      }),
    });
    if (!response.ok) return errorResult('OpenAI web search', response);
    const payload = await response.json() as { output_text?: unknown };
    return typeof payload.output_text === 'string' && payload.output_text
      ? { ok: true, output: payload.output_text.slice(0, MAX_RESULT_CHARS) }
      : { ok: false, output: 'OpenAI web search returned no text result.' };
  }
}

function readQuery(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_QUERY_CHARS) : '';
}

function readDomains(value: unknown) {
  if (typeof value !== 'string') return [];
  return [...new Set(value.split(',').map((domain) => domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''))
    .filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)))]
    .slice(0, MAX_DOMAINS);
}

async function errorResult(name: string, response: Response): Promise<ToolResult> {
  return { ok: false, output: `${name} failed (${response.status}): ${(await response.text()).slice(0, 800)}` };
}

function formatSearchPayload(payload: unknown, answerField: string, resultsField: string): ToolResult {
  if (!isObject(payload)) return { ok: false, output: 'Search connector returned an invalid response.' };
  const answer = typeof payload[answerField] === 'string' ? payload[answerField].trim() : '';
  const results = Array.isArray(payload[resultsField]) ? payload[resultsField] : [];
  const sources = results.flatMap((result) => {
    if (!isObject(result)) return [];
    const url = typeof result.url === 'string' ? result.url : '';
    if (!url) return [];
    const title = typeof result.title === 'string' ? result.title : url;
    const content = typeof result.content === 'string' ? result.content : typeof result.snippet === 'string' ? result.snippet : '';
    return [`- ${title}: ${url}${content ? `\n  ${content.slice(0, 800)}` : ''}`];
  }).slice(0, 6);
  const output = [answer, sources.length ? `Sources:\n${sources.join('\n')}` : ''].filter(Boolean).join('\n\n').slice(0, MAX_RESULT_CHARS);
  return output ? { ok: true, output } : { ok: false, output: 'Search connector returned no results.' };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
