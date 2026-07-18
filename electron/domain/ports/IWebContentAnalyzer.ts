export interface IWebContentAnalyzer {
  analyze(input: { url: string; content: string; prompt: string; preapproved: boolean }, signal?: AbortSignal): Promise<string>;
}
