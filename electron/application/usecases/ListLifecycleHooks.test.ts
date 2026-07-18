import { describe, expect, it } from 'vitest';
import { ListLifecycleHooks } from './ListLifecycleHooks.js';

describe('ListLifecycleHooks', () => {
  it('returns a deterministic summary without context, reasons or audit labels', async () => {
    const useCase = new ListLifecycleHooks({ list: async () => [
      { id: 'tool', event: 'PreToolUse', matcher: 'run_*', actions: [{ type: 'require_approval', reason: 'secret review reason' }] },
      { id: 'session', event: 'SessionStart', actions: [{ type: 'add_context', content: 'private workspace guidance' }] },
    ] });
    await expect(useCase.execute('/workspace')).resolves.toEqual([
      { id: 'tool', event: 'PreToolUse', matcher: 'run_*', actionTypes: ['require_approval'] },
      { id: 'session', event: 'SessionStart', actionTypes: ['add_context'] },
    ]);
  });
});
