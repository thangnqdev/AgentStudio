import type { RuntimeEvaluationWebPage } from '../../domain/entities/agentEvaluation.js';
import type { IWebPageFetcher } from '../../domain/ports/IWebPageFetcher.js';

export class ScriptedEvaluationWebPageFetcher implements IWebPageFetcher {
  private readonly pages: ReadonlyMap<string, RuntimeEvaluationWebPage>;

  constructor(pages: readonly RuntimeEvaluationWebPage[]) {
    this.pages = new Map(pages.map((page) => [page.url, page]));
  }

  async fetch(url: string) {
    const page = this.pages.get(url);
    if (!page) throw new Error(`Scripted WebFetch page is missing: ${url}`);
    return {
      type: 'content' as const,
      url,
      code: page.code ?? 200,
      codeText: page.codeText ?? 'OK',
      contentType: page.contentType ?? 'text/markdown; charset=utf-8',
      body: new TextEncoder().encode(page.content),
    };
  }
}
