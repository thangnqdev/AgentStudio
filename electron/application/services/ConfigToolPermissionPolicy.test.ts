import { describe, expect, it, vi } from 'vitest';
import { AGENT_CONFIG_TOOL_DEFINITION } from '../../domain/entities/agentConfig.js';
import { ConfigToolPermissionPolicy } from './ConfigToolPermissionPolicy.js';

const input = (args: Record<string, unknown>) => ({
  tool: AGENT_CONFIG_TOOL_DEFINITION,
  permissionMode: 'danger-full-access' as const,
  args,
  workspaceRoot: '/workspace',
});

describe('ConfigToolPermissionPolicy', () => {
  it('evaluates reads as read-only without suppressing central policy', async () => {
    const evaluate = vi.fn(async () => ({ allowed: true, requiresApproval: false }));
    const policy = new ConfigToolPermissionPolicy({ evaluate });
    expect(await policy.evaluate(input({ setting: 'model' }))).toEqual({ allowed: true, requiresApproval: false });
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({
      tool: expect.objectContaining({ name: 'Config', risk: 'read', readOnly: true }),
    }));
  });

  it('always requires local approval for mutations, including danger-full-access', async () => {
    const allow = new ConfigToolPermissionPolicy({ evaluate: async () => ({ allowed: true, requiresApproval: false }) });
    expect(await allow.evaluate(input({ setting: 'model', value: 'model-b' }))).toEqual({ allowed: true, requiresApproval: true });
    const deny = new ConfigToolPermissionPolicy({ evaluate: async () => ({ allowed: false, requiresApproval: false, reason: 'Denied.' }) });
    expect(await deny.evaluate(input({ setting: 'model', value: 'model-b' }))).toMatchObject({ allowed: false, reason: 'Denied.' });
  });
});
