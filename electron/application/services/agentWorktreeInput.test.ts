import { describe, expect, it } from 'vitest';
import { parseEnterWorktreeInput, parseExitWorktreeInput, validateWorktreeName } from './agentWorktreeInput.js';

describe('agent worktree input', () => {
  it('accepts nested safe names and exact exit actions', () => {
    expect(parseEnterWorktreeInput({ name: 'user/feature-1' })).toEqual({ name: 'user/feature-1' });
    expect(parseExitWorktreeInput({ action: 'remove', discard_changes: true }))
      .toEqual({ action: 'remove', discardChanges: true });
  });

  it('generates a bounded name when omitted', () => {
    expect(parseEnterWorktreeInput({}, () => 'session-fixed')).toEqual({ name: 'session-fixed' });
  });

  it('rejects traversal, absolute, malformed, and extra input', () => {
    for (const name of ['../escape', '/absolute', 'a//b', 'bad name', 'x'.repeat(65)]) {
      expect(() => validateWorktreeName(name)).toThrow();
    }
    expect(() => parseEnterWorktreeInput({ name: 'safe', path: '/tmp' })).toThrow('Unexpected');
    expect(() => parseExitWorktreeInput({ action: 'delete' })).toThrow('keep or remove');
  });
});
