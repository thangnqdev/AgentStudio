import { describe, expect, it } from 'vitest';
import { AgentToolExecutor } from '../tools/AgentToolExecutor.js';

describe('OpenAIProvider tool capabilities', () => {
  it('exposes web search only when its independent connector is enabled', async () => {
    expect((await new AgentToolExecutor({ provider: 'openai' }).list('/workspace')).some((tool) => tool.name === 'web_search')).toBe(true);
    expect((await new AgentToolExecutor({ provider: 'disabled' }).list('/workspace')).some((tool) => tool.name === 'web_search')).toBe(false);
  });
});
