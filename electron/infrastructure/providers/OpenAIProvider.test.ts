import { describe, expect, it } from 'vitest';
import { getToolDefinitions } from './OpenAIProvider.js';

describe('OpenAIProvider tool capabilities', () => {
  it('exposes web search from an independent connector capability', () => {
    const openAI = { baseUrl: 'https://api.openai.com/v1', apiKey: 'key', model: 'gpt-5.5', permissionMode: 'workspace-write' as const };
    const compatibleProxy = { ...openAI, baseUrl: 'https://proxy.example.com/v1' };

    expect(getToolDefinitions({ ...openAI, webSearchEnabled: true }).some((tool) => tool.function.name === 'web_search')).toBe(true);
    expect(getToolDefinitions({ ...compatibleProxy, webSearchEnabled: true }).some((tool) => tool.function.name === 'web_search')).toBe(true);
    expect(getToolDefinitions({ ...openAI, webSearchEnabled: false }).some((tool) => tool.function.name === 'web_search')).toBe(false);
  });
});
