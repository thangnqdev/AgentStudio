import { describe, expect, it } from 'vitest';
import { buildAgentCollaborationContinuation } from './agentCollaborationContinuation.js';

describe('buildAgentCollaborationContinuation', () => {
  it('returns trusted orchestration instructions after safely wrapped worker results', () => {
    const messages = buildAgentCollaborationContinuation([{
      id: 'notice', sender: 'user',
      content: '<agent-notification status="completed">review complete</agent-notification>',
    }]);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: 'system' });
    expect(String(messages[0].content)).toContain('Result 1: review complete');
    expect(messages[1]).toMatchObject({ role: 'user' });
    expect(String(messages[1].content)).toContain('reconcile their findings');
    expect(String(messages[1].content)).toContain('integration and verification');
  });

  it('does not create a continuation without worker results', () => {
    expect(buildAgentCollaborationContinuation([])).toEqual([]);
  });
});
