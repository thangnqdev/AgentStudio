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
});
