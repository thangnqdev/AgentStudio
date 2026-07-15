import { describe, expect, it, vi } from 'vitest';
import { ManageAgentPlanMode } from '../usecases/ManageAgentPlanMode.js';
import { PlanAwareToolPermissionPolicy } from './PlanAwareToolPermissionPolicy.js';

describe('PlanAwareToolPermissionPolicy', () => {
  it('blocks mutations before the normal approval policy while plan mode is active', async () => {
    const evaluate = vi.fn(async () => ({ allowed: true, requiresApproval: false }));
    const plans = new ManageAgentPlanMode({ save: async () => ({ reference: 'plan.md' }) });
    plans.enter('chat-a');
    const policy = new PlanAwareToolPermissionPolicy({ evaluate }, plans, 'chat-a');
    const decision = await policy.evaluate({
      tool: { name: 'write_file', description: 'write', risk: 'write', parameters: {} },
      permissionMode: 'danger-full-access', args: { path: 'a' }, workspaceRoot: '/workspace',
    });
    expect(decision).toMatchObject({ allowed: false, requiresApproval: false });
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('allows read-only exploration and web search through the base policy', async () => {
    const evaluate = vi.fn(async () => ({ allowed: true, requiresApproval: false }));
    const plans = new ManageAgentPlanMode({ save: async () => ({ reference: 'plan.md' }) });
    plans.enter('chat-a');
    const policy = new PlanAwareToolPermissionPolicy({ evaluate }, plans, 'chat-a');
    await policy.evaluate({ tool: { name: 'read_file', description: 'read', risk: 'read', parameters: {} }, permissionMode: 'read-only', args: {}, workspaceRoot: '/workspace' });
    await policy.evaluate({ tool: { name: 'web_search', description: 'search', risk: 'network', parameters: {} }, permissionMode: 'read-only', args: {}, workspaceRoot: '/workspace' });
    expect(evaluate).toHaveBeenCalledTimes(2);
  });
});
