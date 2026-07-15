import { describe, expect, it } from 'vitest';
import { parseAgentWorkerSpawnRequest, parseSendMessageRequest } from './agentWorkerInput.js';

describe('agent worker input', () => {
  it('parses the Claude-compatible Agent contract', () => {
    expect(parseAgentWorkerSpawnRequest({
      description: 'Review authentication flow', prompt: 'Inspect and fix auth.', subagent_type: 'reviewer',
      model: 'sonnet', run_in_background: true, name: 'auth-reviewer', mode: 'workspace-write', isolation: 'worktree',
    })).toEqual({
      description: 'Review authentication flow', prompt: 'Inspect and fix auth.', subagentType: 'reviewer',
      model: 'sonnet', runInBackground: true, name: 'auth-reviewer', mode: 'workspace-write', isolation: 'worktree',
    });
  });

  it('rejects escalation-shaped or ambiguous spawn input', () => {
    expect(() => parseAgentWorkerSpawnRequest({ description: 'x', prompt: 'y', isolation: 'worktree', cwd: '/tmp' })).toThrow('mutually exclusive');
    expect(() => parseAgentWorkerSpawnRequest({ description: 'x', prompt: 'y', unexpected: true })).toThrow('Unexpected input');
    expect(() => parseAgentWorkerSpawnRequest({ description: 'x', prompt: '', run_in_background: 'yes' })).toThrow('prompt');
  });

  it('requires a 5-10 word preview for text and validates structured messages', () => {
    expect(parseSendMessageRequest({ to: 'reviewer', summary: 'Please inspect the latest failing authentication tests', message: 'Focus on the timeout.' }))
      .toMatchObject({ to: 'reviewer', message: 'Focus on the timeout.' });
    expect(() => parseSendMessageRequest({ to: '@reviewer', summary: 'Please inspect the latest failing tests now', message: 'x' })).toThrow('Do not prefix');
    expect(() => parseSendMessageRequest({ to: 'reviewer', summary: 'too short', message: 'x' })).toThrow('5-10');
    expect(() => parseSendMessageRequest({ to: '*', message: { type: 'shutdown_request' } })).toThrow('cannot be broadcast');
    expect(parseSendMessageRequest({ to: 'reviewer', message: { type: 'shutdown_response', request_id: 'request-1', approve: true } }))
      .toEqual({ to: 'reviewer', message: { type: 'shutdown_response', request_id: 'request-1', approve: true } });
  });
});
