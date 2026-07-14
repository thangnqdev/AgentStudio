import { describe, expect, it } from 'vitest';
import { evaluateLifecycleHooks, normalizeLifecycleHookDocument } from './lifecycleHook.js';

describe('lifecycle hooks', () => {
  it('normalizes and applies deterministic tool matchers', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: {
        PreToolUse: [
          { id: 'review-shell', matcher: 'run_*', actions: [
            { type: 'require_approval', reason: 'Review shell commands.' },
            { type: 'audit', label: 'shell-review' },
          ] },
          { id: 'block-network', matcher: 'web_*', actions: [{ type: 'deny_tool', reason: 'Network access is disabled.' }] },
        ],
      },
    });

    expect(evaluateLifecycleHooks(hooks, 'PreToolUse', 'run_command')).toEqual({
      matchedHookIds: ['review-shell'], contexts: [], denyReason: undefined,
      approvalReason: 'Review shell commands.', auditLabels: ['shell-review'],
    });
    expect(evaluateLifecycleHooks(hooks, 'PreToolUse', 'read_file').matchedHookIds).toEqual([]);
  });

  it('supports bounded context at integrated lifecycle events', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: { SessionStart: [{ id: 'project-guidance', actions: [{ type: 'add_context', content: 'Run focused tests.' }] }] },
    });
    expect(evaluateLifecycleHooks(hooks, 'SessionStart').contexts).toEqual(['Run focused tests.']);
  });

  it('rejects unsupported events and permission-expanding action types', () => {
    expect(() => normalizeLifecycleHookDocument({
      version: 1,
      hooks: { WorktreeCreate: [{ id: 'future', actions: [{ type: 'audit', label: 'future' }] }] },
    })).toThrow('not integrated yet');
    expect(() => normalizeLifecycleHookDocument({
      version: 1,
      hooks: { PreToolUse: [{ id: 'unsafe', actions: [{ type: 'allow_tool', reason: 'bypass' }] }] },
    })).toThrow('unsupported type');
  });

  it('rejects matchers on events whose payload must not be pattern-inspected', () => {
    expect(() => normalizeLifecycleHookDocument({
      version: 1,
      hooks: { UserPromptSubmit: [{ id: 'prompt-match', matcher: '*secret*', actions: [{ type: 'audit', label: 'prompt' }] }] },
    })).toThrow('cannot declare a matcher');
  });

  it('rejects duplicate identities across lifecycle events', () => {
    expect(() => normalizeLifecycleHookDocument({
      version: 1,
      hooks: {
        SessionStart: [{ id: 'duplicate', actions: [{ type: 'audit', label: 'start' }] }],
        PostToolUse: [{ id: 'duplicate', actions: [{ type: 'audit', label: 'tool' }] }],
      },
    })).toThrow('Duplicate lifecycle hook id');
  });
});
