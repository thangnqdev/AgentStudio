import { describe, expect, it } from 'vitest';
import { MAX_SUBAGENT_PROMPT_CHARACTERS, parseSubagentRequest } from './subagent.js';

describe('parseSubagentRequest', () => {
  it('defaults to the read-only exploration role', () => {
    expect(parseSubagentRequest({ prompt: ' inspect the repository ' })).toEqual({ prompt: 'inspect the repository', role: 'explore' });
  });

  it('rejects unknown roles and oversized prompts', () => {
    expect(() => parseSubagentRequest({ prompt: 'review', role: 'admin' })).toThrow('role is invalid');
    expect(() => parseSubagentRequest({ prompt: 'x'.repeat(MAX_SUBAGENT_PROMPT_CHARACTERS + 1) })).toThrow('exceeds');
    expect(() => parseSubagentRequest({ prompt: 'review', agentId: '../escape' })).toThrow('agentId is invalid');
  });
});
