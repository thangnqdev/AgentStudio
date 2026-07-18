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
    expect(evaluateLifecycleHooks(hooks, 'PreToolUse', 'Bash', 'run_command').matchedHookIds).toEqual(['review-shell']);
  });

  it('supports bounded context at integrated lifecycle events', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: { SessionStart: [{ id: 'project-guidance', actions: [{ type: 'add_context', content: 'Run focused tests.' }] }] },
    });
    expect(evaluateLifecycleHooks(hooks, 'SessionStart').contexts).toEqual(['Run focused tests.']);
  });

  it('supports matching and blocking task lifecycle events', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: {
        TaskCreated: [{ id: 'require-tests', matcher: '*release*', actions: [{ type: 'block_task', reason: 'Add a test task first.' }] }],
        TaskCompleted: [{ id: 'audit-completion', actions: [{ type: 'audit', label: 'task-done' }] }],
      },
    });

    expect(evaluateLifecycleHooks(hooks, 'TaskCreated', 'Prepare release').taskBlockReason).toBe('Add a test task first.');
    expect(evaluateLifecycleHooks(hooks, 'TaskCreated', 'Read docs').matchedHookIds).toEqual([]);
    expect(evaluateLifecycleHooks(hooks, 'TaskCompleted').auditLabels).toEqual(['task-done']);
  });

  it('supports audit-only permission lifecycle matchers without granting authority', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: {
        PermissionRequest: [{ id: 'review-write', matcher: 'write_*', actions: [{ type: 'audit', label: 'approval-opened' }] }],
        PermissionDenied: [{ id: 'record-denial', matcher: '*', actions: [{ type: 'audit', label: 'approval-denied' }] }],
      },
    });
    expect(evaluateLifecycleHooks(hooks, 'PermissionRequest', 'write_file').auditLabels).toEqual(['approval-opened']);
    expect(evaluateLifecycleHooks(hooks, 'PermissionRequest', 'read_file').matchedHookIds).toEqual([]);
    expect(() => normalizeLifecycleHookDocument({
      version: 1,
      hooks: { PermissionRequest: [{ id: 'unsafe', actions: [{ type: 'require_approval', reason: 'again' }] }] },
    })).toThrow('only valid for PreToolUse');
  });

  it('matches capability-free subagent lifecycle audits', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: {
        SubagentStart: [{ id: 'reviewer-start', matcher: 'review*', actions: [{ type: 'audit', label: 'review-start' }] }],
        SubagentStop: [{ id: 'reviewer-stop', matcher: 'review*', actions: [{ type: 'audit', label: 'review-stop' }] }],
        SessionEnd: [{ id: 'session-end', actions: [{ type: 'audit', label: 'session-end' }] }],
      },
    });
    expect(evaluateLifecycleHooks(hooks, 'SubagentStart', 'reviewer').auditLabels).toEqual(['review-start']);
    expect(evaluateLifecycleHooks(hooks, 'SubagentStop', 'builder').matchedHookIds).toEqual([]);
    expect(evaluateLifecycleHooks(hooks, 'SessionEnd').auditLabels).toEqual(['session-end']);
  });

  it('matches audit-only worktree lifecycle events', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: {
        WorktreeCreate: [{ id: 'feature-worktree', matcher: 'agent/*', actions: [{ type: 'audit', label: 'worktree-created' }] }],
        WorktreeRemove: [{ id: 'remove-worktree', actions: [{ type: 'audit', label: 'worktree-removed' }] }],
      },
    });
    expect(evaluateLifecycleHooks(hooks, 'WorktreeCreate', 'agent/feature').auditLabels).toEqual(['worktree-created']);
    expect(evaluateLifecycleHooks(hooks, 'WorktreeRemove').auditLabels).toEqual(['worktree-removed']);
  });

  it('audits config changes and instruction loading without accepting capability actions', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: {
        ConfigChange: [{ id: 'permission-config', matcher: 'permissions.*', actions: [{ type: 'audit', label: 'permission-config' }] }],
        InstructionsLoaded: [{ id: 'instructions', actions: [{ type: 'audit', label: 'instructions-loaded' }] }],
      },
    });
    expect(evaluateLifecycleHooks(hooks, 'ConfigChange', 'permissions.defaultMode').auditLabels).toEqual(['permission-config']);
    expect(evaluateLifecycleHooks(hooks, 'InstructionsLoaded').auditLabels).toEqual(['instructions-loaded']);
    expect(() => normalizeLifecycleHookDocument({
      version: 1,
      hooks: { InstructionsLoaded: [{ id: 'context', actions: [{ type: 'add_context', content: 'unsafe late context' }] }] },
    })).toThrow('cannot add context');
  });

  it('supports audit-only compaction lifecycle events', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: {
        PreCompact: [{ id: 'compact-start', actions: [{ type: 'audit', label: 'compact-start' }] }],
        PostCompact: [{ id: 'compact-finish', actions: [{ type: 'audit', label: 'compact-finish' }] }],
      },
    });
    expect(evaluateLifecycleHooks(hooks, 'PreCompact').auditLabels).toEqual(['compact-start']);
    expect(evaluateLifecycleHooks(hooks, 'PostCompact').auditLabels).toEqual(['compact-finish']);
    expect(() => normalizeLifecycleHookDocument({
      version: 1,
      hooks: { PreCompact: [{ id: 'unsafe', actions: [{ type: 'add_context', content: 'late context' }] }] },
    })).toThrow('cannot add context');
  });

  it('matches audit-only file-change events', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: { FileChanged: [{ id: 'typescript-change', matcher: 'src/*.ts', actions: [{ type: 'audit', label: 'source-changed' }] }] },
    });
    expect(evaluateLifecycleHooks(hooks, 'FileChanged', 'src/main.ts').auditLabels).toEqual(['source-changed']);
    expect(evaluateLifecycleHooks(hooks, 'FileChanged', 'README.md').matchedHookIds).toEqual([]);
    expect(() => normalizeLifecycleHookDocument({
      version: 1,
      hooks: { FileChanged: [{ id: 'unsafe', actions: [{ type: 'add_context', content: 'late context' }] }] },
    })).toThrow('cannot add context');
  });

  it('matches audit-only cwd-change events', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: { CwdChanged: [{ id: 'worktree-cwd', matcher: '*/worktrees/*', actions: [{ type: 'audit', label: 'cwd-changed' }] }] },
    });
    expect(evaluateLifecycleHooks(hooks, 'CwdChanged', '/private/worktrees/feature').auditLabels).toEqual(['cwd-changed']);
    expect(() => normalizeLifecycleHookDocument({
      version: 1,
      hooks: { CwdChanged: [{ id: 'unsafe', actions: [{ type: 'add_context', content: 'late context' }] }] },
    })).toThrow('cannot add context');
  });

  it('matches audit-only teammate-idle events', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: { TeammateIdle: [{ id: 'reviewer-idle', matcher: 'review*', actions: [{ type: 'audit', label: 'reviewer-idle' }] }] },
    });
    expect(evaluateLifecycleHooks(hooks, 'TeammateIdle', 'reviewer').auditLabels).toEqual(['reviewer-idle']);
    expect(() => normalizeLifecycleHookDocument({
      version: 1,
      hooks: { TeammateIdle: [{ id: 'unsafe', actions: [{ type: 'block_task', reason: 'late block' }] }] },
    })).toThrow('only valid for TaskCreated and TaskCompleted');
  });

  it('matches audit-only elicitation request/result events', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: {
        Elicitation: [{ id: 'question-opened', matcher: 'questions', actions: [{ type: 'audit', label: 'question-opened' }] }],
        ElicitationResult: [{ id: 'question-closed', matcher: 'questions', actions: [{ type: 'audit', label: 'question-closed' }] }],
      },
    });
    expect(evaluateLifecycleHooks(hooks, 'Elicitation', 'questions').auditLabels).toEqual(['question-opened']);
    expect(evaluateLifecycleHooks(hooks, 'ElicitationResult', 'questions').auditLabels).toEqual(['question-closed']);
    expect(() => normalizeLifecycleHookDocument({
      version: 1,
      hooks: { Elicitation: [{ id: 'unsafe', actions: [{ type: 'add_context', content: 'late context' }] }] },
    })).toThrow('cannot add context');
  });

  it('matches audit-only renderer notification events', () => {
    const hooks = normalizeLifecycleHookDocument({
      version: 1,
      hooks: { Notification: [{ id: 'background-failure', matcher: 'background-command:failed', actions: [{ type: 'audit', label: 'background-failure' }] }] },
    });
    expect(evaluateLifecycleHooks(hooks, 'Notification', 'background-command:failed').auditLabels).toEqual(['background-failure']);
    expect(evaluateLifecycleHooks(hooks, 'Notification', 'background-command:completed').matchedHookIds).toEqual([]);
  });

  it('rejects task-blocking actions outside task lifecycle events', () => {
    expect(() => normalizeLifecycleHookDocument({
      version: 1,
      hooks: { PreToolUse: [{ id: 'wrong-event', actions: [{ type: 'block_task', reason: 'No.' }] }] },
    })).toThrow('only valid for TaskCreated and TaskCompleted');
  });

  it('rejects unsupported events and permission-expanding action types', () => {
    expect(() => normalizeLifecycleHookDocument({
      version: 1,
      hooks: { Setup: [{ id: 'future', actions: [{ type: 'audit', label: 'future' }] }] },
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
