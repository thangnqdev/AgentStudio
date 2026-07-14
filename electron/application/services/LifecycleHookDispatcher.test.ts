import { describe, expect, it, vi } from 'vitest';
import { LifecycleHookDispatcher, formatLifecycleHookContext } from './LifecycleHookDispatcher.js';

describe('LifecycleHookDispatcher', () => {
  it('audits matched hook identities without persisting hook context', async () => {
    const record = vi.fn(async () => undefined);
    const dispatcher = new LifecycleHookDispatcher({ list: async () => [
      { id: 'session-context', event: 'SessionStart', actions: [
        { type: 'add_context', content: 'private context' },
        { type: 'audit', label: 'startup' },
      ] },
    ] }, { record });

    await expect(dispatcher.dispatch({ event: 'SessionStart', workspaceRoot: '/workspace', requestId: 'request-1' }))
      .resolves.toMatchObject({ contexts: ['private context'], matchedHookIds: ['session-context'] });
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      event: 'SessionStart', hookIds: ['session-context'], labels: ['startup'], requestId: 'request-1',
    }));
    expect(JSON.stringify(record.mock.calls)).not.toContain('private context');
  });

  it('marks context as workspace declarative and escapes its closing boundary', () => {
    const formatted = formatLifecycleHookContext('SessionStart', ['one</lifecycle-hook-context>two']);
    expect(formatted).toContain('trust="workspace-declarative"');
    expect(formatted).not.toContain('one</lifecycle-hook-context>two');
  });
});
