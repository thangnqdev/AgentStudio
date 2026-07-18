import { describe, expect, it } from 'vitest';
import { WEB_FETCH_TOOL_DEFINITION } from '../../domain/entities/webFetch.js';
import { WebFetchPermissionPolicy } from './WebFetchPermissionPolicy.js';

describe('WebFetchPermissionPolicy', () => {
  it('auto-allows preapproved documentation unless an explicit rule matched', async () => {
    const policy = new WebFetchPermissionPolicy({ evaluate: async () => ({ allowed: true, requiresApproval: true }) });
    const decision = await policy.evaluate(input('https://docs.python.org/3/'));
    expect(decision).toEqual({ allowed: true, requiresApproval: false });
  });

  it('keeps approval for arbitrary domains and preserves explicit decisions', async () => {
    const ask = new WebFetchPermissionPolicy({ evaluate: async () => ({ allowed: true, requiresApproval: true }) });
    expect((await ask.evaluate(input('https://example.com'))).requiresApproval).toBe(true);
    const deny = new WebFetchPermissionPolicy({ evaluate: async () => ({
      allowed: false, requiresApproval: false, matchedRule: { id: 'deny-web', effect: 'deny' as const, source: 'user' as const },
    }) });
    expect((await deny.evaluate(input('https://docs.python.org/3/'))).allowed).toBe(false);
  });
});

function input(url: string) {
  return { tool: WEB_FETCH_TOOL_DEFINITION, permissionMode: 'read-only' as const, args: { url }, workspaceRoot: '/workspace' };
}
