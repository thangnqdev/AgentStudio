import { describe, expect, it } from 'vitest';
import { LifecycleHookPermissionRuleSource } from './LifecycleHookPermissionRuleSource.js';

describe('LifecycleHookPermissionRuleSource', () => {
  it('only translates restrictive PreToolUse actions', async () => {
    const source = new LifecycleHookPermissionRuleSource({ list: async () => [
      { id: 'shell', event: 'PreToolUse', matcher: 'run_*', actions: [
        { type: 'require_approval', reason: 'review' },
        { type: 'audit', label: 'shell' },
      ] },
      { id: 'startup', event: 'SessionStart', actions: [{ type: 'add_context', content: 'hello' }] },
    ] });
    await expect(source.list('/workspace')).resolves.toEqual([
      { id: 'hook:shell:1', effect: 'ask', source: 'workspace', toolGlob: 'run_*' },
    ]);
  });
});
