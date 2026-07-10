import { describe, expect, it } from 'vitest';
import { getToolDefinitions, supportsOpenAIWebSearch } from './OpenAIProvider.js';

describe('OpenAIProvider tool capabilities', () => {
  it('only exposes web search for OpenAI Responses-compatible settings', () => {
    const openAI = { baseUrl: 'https://api.openai.com/v1', apiKey: 'key', model: 'gpt-5.5', permissionMode: 'workspace-write' as const };
    const compatibleProxy = { ...openAI, baseUrl: 'https://proxy.example.com/v1' };

    expect(supportsOpenAIWebSearch(openAI)).toBe(true);
    expect(supportsOpenAIWebSearch(compatibleProxy)).toBe(false);
    expect(getToolDefinitions(openAI).some((tool) => tool.function.name === 'web_search')).toBe(true);
    expect(getToolDefinitions(compatibleProxy).some((tool) => tool.function.name === 'web_search')).toBe(false);
  });
});
