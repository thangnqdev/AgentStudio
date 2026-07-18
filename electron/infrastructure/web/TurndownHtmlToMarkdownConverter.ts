import type { IHtmlToMarkdownConverter } from '../../domain/ports/IHtmlToMarkdownConverter.js';

type TurndownInstance = { turndown(html: string): string };
type TurndownConstructor = new () => TurndownInstance;

export class TurndownHtmlToMarkdownConverter implements IHtmlToMarkdownConverter {
  private service?: Promise<TurndownInstance>;

  async convert(html: string) {
    const service = await (this.service ??= import('turndown').then((module) => {
      const Constructor = module.default as unknown as TurndownConstructor;
      return new Constructor();
    }));
    return service.turndown(html);
  }
}
