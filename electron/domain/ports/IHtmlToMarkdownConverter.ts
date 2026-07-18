export interface IHtmlToMarkdownConverter {
  convert(html: string): Promise<string>;
}
