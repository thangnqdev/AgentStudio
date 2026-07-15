import { describe, expect, it } from 'vitest';
import { restoreHistoricalToolConversation } from './historicalToolConversation.js';

describe('restoreHistoricalToolConversation', () => {
  it('reconstructs matched assistant tool calls and results before final text', () => {
    const messages = [{
      id: 'agent-1', sender: 'agent' as const, content: 'CROSS_STARTED',
      actions: [{
        id: 'provider-call', toolName: 'run_command', args: 'printf marker', risk: 'execute' as const,
        status: 'ok' as const, output: '<task_id>bg-1</task_id>',
      }],
    }];
    const conversation = restoreHistoricalToolConversation(messages, [{ role: 'assistant', content: 'CROSS_STARTED' }]);
    expect(conversation).toHaveLength(3);
    expect(conversation[0]).toMatchObject({ role: 'assistant', tool_calls: [{ function: { name: 'run_command', arguments: '{}' } }] });
    expect(conversation[1]).toMatchObject({ role: 'tool', tool_call_id: 'history-agent-1-0', content: expect.stringContaining('bg-1') });
    expect(conversation[2]).toEqual({ role: 'assistant', content: 'CROSS_STARTED' });
  });

  it('provides a terminal tool result even for a denied historical action', () => {
    const conversation = restoreHistoricalToolConversation([{
      id: 'agent-2', sender: 'agent', content: '',
      actions: [{ id: 'denied', toolName: 'write_file', args: 'path=a', risk: 'write', status: 'denied' }],
    }], [{ role: 'assistant', content: '' }]);
    expect(conversation).toHaveLength(2);
    expect(conversation[1].content).toContain('"ok":false');
    expect(conversation[1].content).toContain('denied');
  });
});
