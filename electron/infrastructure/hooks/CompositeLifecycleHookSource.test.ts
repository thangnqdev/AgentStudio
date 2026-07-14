import { describe, expect, it } from 'vitest';
import { CompositeLifecycleHookSource } from './CompositeLifecycleHookSource.js';

describe('CompositeLifecycleHookSource', () => {
  it('fails closed on ambiguous identities across hook sources', async () => {
    const hook = { id: 'duplicate', event: 'SessionStart' as const, actions: [{ type: 'audit' as const, label: 'seen' }] };
    const source = new CompositeLifecycleHookSource([{ list: async () => [hook] }, { list: async () => [hook] }]);
    await expect(source.list('/workspace')).rejects.toThrow('Duplicate lifecycle hook id across sources');
  });
});
