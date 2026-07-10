import { describe, expect, it } from 'vitest';
import { validateWebSearchSettings } from './webSearchSettings.js';

describe('validateWebSearchSettings', () => {
  it('accepts a self-hosted SearXNG connector without an API key', () => {
    expect(validateWebSearchSettings({ provider: 'searxng', baseUrl: 'http://localhost:8080' })).toEqual({
      provider: 'searxng',
      baseUrl: 'http://localhost:8080',
      apiKey: '',
      model: '',
    });
  });

  it('requires a key for a new Tavily connector', () => {
    expect(() => validateWebSearchSettings({ provider: 'tavily', baseUrl: 'https://api.tavily.com/search' })).toThrow('Tavily requires an API key');
  });

  it('allows retaining an existing connector key', () => {
    expect(validateWebSearchSettings({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.5' }, true).apiKey).toBe('');
  });
});
