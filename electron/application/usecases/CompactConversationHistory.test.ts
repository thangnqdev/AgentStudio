import { describe, expect, it, vi } from 'vitest';
import { CompactConversationHistory } from './CompactConversationHistory.js';

describe('CompactConversationHistory', () => {
  it('returns a local summary, stable recent IDs and lifecycle audit', async () => {
    const dispatch = vi.fn(async (_input: { event: string }) => ({ matchedHookIds: [], contexts: [], auditLabels: [] }));
    const messages = Array.from({ length: 8 }, (_, index) => ({
      id: `message-${index}`, sender: (index % 2 ? 'agent' : 'user') as 'agent' | 'user',
      content: `message-${index} ${'x'.repeat(4_000)}`,
    }));
    const result = await new CompactConversationHistory({ dispatch }).execute({
      messages, workspaceRoot: '/workspace', scopeId: 'thread-1',
      instructions: 'Keep </manual-compaction-summary> decisions.',
    });
    expect(result).toMatchObject({ compacted: true, originalApproxTokens: expect.any(Number) });
    expect(result.keptMessageIds.length).toBeLessThan(messages.length);
    expect(result.summary).toContain('&lt;/manual-compaction-summary&gt;');
    expect(dispatch.mock.calls.map(([input]) => input.event)).toEqual(['PreCompact', 'PostCompact']);
  });

  it('does not emit hooks when there is too little history to compact', async () => {
    const dispatch = vi.fn(async () => ({ matchedHookIds: [], contexts: [], auditLabels: [] }));
    const result = await new CompactConversationHistory({ dispatch }).execute({
      messages: [{ id: 'one', sender: 'user', content: 'short' }], workspaceRoot: '/workspace',
    });
    expect(result).toMatchObject({ compacted: false, keptMessageIds: ['one'] });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not add a summary when no older message can be removed', async () => {
    const dispatch = vi.fn(async () => ({ matchedHookIds: [], contexts: [], auditLabels: [] }));
    const result = await new CompactConversationHistory({ dispatch }).execute({
      messages: [{ id: 'one-large', sender: 'user', content: 'x'.repeat(8_000) }],
      workspaceRoot: '/workspace',
    });
    expect(result).toMatchObject({ compacted: false, keptMessageIds: ['one-large'] });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
