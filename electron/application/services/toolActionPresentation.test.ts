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
    const agent = summarizeToolArguments('Agent', { description: 'Review auth flow', name: 'reviewer', prompt: 'private worker prompt', run_in_background: true });
    expect(agent).toBe('description=Review auth flow name=reviewer background=true (21 prompt characters)');
    expect(agent).not.toContain('private worker prompt');
    const message = summarizeToolArguments('SendMessage', { to: 'reviewer', summary: 'Please inspect the timeout path now', message: 'private redirect' });
    expect(message).toBe('to=reviewer (16 message characters)');
    expect(message).not.toContain('private redirect');
  });

  it('summarizes worktree lifecycle decisions without paths or file contents', () => {
    expect(summarizeToolArguments('EnterWorktree', { name: 'feature/auth' })).toBe('name=feature/auth');
    expect(summarizeToolArguments('ExitWorktree', { action: 'remove', discard_changes: true }))
      .toBe('action=remove discard_changes=true');
    expect(summarizeToolArguments('ExitWorktree', {})).toBe('action=invalid discard_changes=false');
  });
});
