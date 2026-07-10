import type { AgentProviderSettings, ToolResult } from '../../domain/entities/agent.js';
import { supportsOpenAIWebSearch } from '../providers/OpenAIProvider.js';

const MAX_QUERY_CHARS = 1_000;
const MAX_RESULT_CHARS = 12_000;
const MAX_DOMAINS = 20;

type WebSearchResponse = {
  output_text?: unknown;
  output?: unknown;
};

/** Executes OpenAI's hosted web search without exposing the API key to the renderer. */
export class OpenAIWebSearchExecutor {
  private readonly settings: AgentProviderSettings;

  constructor(settings: AgentProviderSettings) {
    this.settings = settings;
  }

  async search(args: Record<string, unknown>): Promise<ToolResult> {
    if (!supportsOpenAIWebSearch(this.settings)) {
      return {
        ok: false,
        output: 'web_search requires an OpenAI API key and the official https://api.openai.com/v1 base URL. Other providers need their own web-search connector.',
      };
    }

    const query = this.readQuery(args.query);
    if (!query) return { ok: false, output: 'Web search query is empty.' };

    const response = await fetch(this.buildEndpoint('responses'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.settings.apiKey}`,
      },
      body: JSON.stringify({
        model: this.settings.model,
        input: query,
        tools: [{
          type: 'web_search',
          search_context_size: 'medium',
          ...(this.readDomains(args.domains).length > 0
            ? { filters: { allowed_domains: this.readDomains(args.domains) } }
            : {}),
        }],
        tool_choice: 'required',
        include: ['web_search_call.action.sources'],
      }),
    });

    if (!response.ok) {
      const details = (await response.text()).slice(0, 800);
      return { ok: false, output: `OpenAI web search failed (${response.status}): ${details}` };
    }

    const payload = await response.json() as WebSearchResponse;
    const output = this.readOutput(payload);
    return output
      ? { ok: true, output }
      : { ok: false, output: 'OpenAI web search returned no text result.' };
  }

  private buildEndpoint(endpoint: string) {
    return new URL(endpoint, `${this.settings.baseUrl.replace(/\/$/, '')}/`).toString();
  }

  private readQuery(value: unknown) {
    return typeof value === 'string' ? value.trim().slice(0, MAX_QUERY_CHARS) : '';
  }

  private readDomains(value: unknown) {
    if (typeof value !== 'string') return [];
    return [...new Set(value.split(',')
      .map((domain) => domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''))
      .filter((domain) => /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)))]
      .slice(0, MAX_DOMAINS);
  }

  private readOutput(payload: WebSearchResponse) {
    if (typeof payload.output_text === 'string') return payload.output_text.slice(0, MAX_RESULT_CHARS);
    if (!Array.isArray(payload.output)) return '';

    const text = payload.output.flatMap((item) => {
      if (!isObject(item) || !Array.isArray(item.content)) return [];
      return item.content.flatMap((content) => isObject(content) && typeof content.text === 'string' ? [content.text] : []);
    }).join('\n');
    return text.slice(0, MAX_RESULT_CHARS);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
