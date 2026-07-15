import { describe, expect, it } from 'vitest';
import { AgentConversationBuilder } from './AgentConversationBuilder.js';

describe('AgentConversationBuilder', () => {
  it('builds a compacted model conversation without mutating durable messages', async () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({
      id: String(index), sender: (index % 2 ? 'agent' : 'user') as 'agent' | 'user', content: `message-${index} ${'x'.repeat(1_000)}`,
    }));
    const formatter = { format: async (recent: typeof messages) => recent.map((message) => ({ role: 'user' as const, content: message.content })) };
    const result = await new AgentConversationBuilder(formatter).build({
      messages, inputContextTokens: 1_000, workspaceRoot: '/workspace',
      settings: { baseUrl: '', apiKey: '', model: 'model', permissionMode: 'workspace-write' },
    });
    expect(result.conversation[0]).toMatchObject({ role: 'system' });
    expect(result.conversation[1]).toMatchObject({ role: 'system', content: expect.stringContaining('locally compacted') });
    expect(result.compactionNotice?.sender).toBe('system');
    expect(messages).toHaveLength(8);
  });

  it('restores historical tool output so follow-up turns retain task identities', async () => {
    const messages = [{
      id: 'agent-history', sender: 'agent' as const, content: 'Started.',
      actions: [{
        id: 'call-1', toolName: 'run_command', args: 'command summary', risk: 'execute' as const,
        status: 'ok' as const, output: '<task_id>bg-cross-turn</task_id>',
      }],
    }];
    const formatter = { format: async () => [{ role: 'assistant' as const, content: 'Started.' }] };
    const result = await new AgentConversationBuilder(formatter).build({
      messages, inputContextTokens: 8_000, workspaceRoot: '/workspace',
      settings: { baseUrl: '', apiKey: '', model: 'model', permissionMode: 'danger-full-access' },
    });
    expect(result.conversation).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'assistant', tool_calls: expect.any(Array) }),
      expect.objectContaining({ role: 'tool', content: expect.stringContaining('bg-cross-turn') }),
    ]));
  });
});
