import { describe, expect, it } from 'vitest';
import { summarizeToolArguments } from './toolActionPresentation.js';

describe('summarizeToolArguments', () => {
  it('does not expose write_file content in the action summary', () => {
    expect(summarizeToolArguments('write_file', { path: 'src/secret.ts', content: 'very secret value' })).toBe('path=src/secret.ts (17 bytes)');
  });

  it('does not expose delegated prompts in the approval summary', () => {
    const summary = summarizeToolArguments('delegate_task', { role: 'review', agentId: 'profile-1', prompt: 'private investigation details' });
    expect(summary).toBe('role=review agentId=profile-1 (29 prompt characters)');
    expect(summary).not.toContain('private investigation');
  });
});
