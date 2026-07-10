export type WebSearchProvider = 'disabled' | 'openai' | 'tavily' | 'searxng';

export type WebSearchSettings = {
  provider: WebSearchProvider;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
};

export type PublicWebSearchSettings = Omit<WebSearchSettings, 'apiKey'> & {
  hasApiKey: boolean;
};
