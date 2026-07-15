import { describe, expect, it, vi } from 'vitest';
import { ManageAgentPlanMode } from './ManageAgentPlanMode.js';

describe('ManageAgentPlanMode', () => {
  it('keeps plan state scoped and persists only an approved plan', async () => {
    const save = vi.fn(async () => ({ reference: 'plan-private.md' }));
    const manager = new ManageAgentPlanMode({ save });
    expect(manager.isActive('chat-a')).toBe(false);
    manager.enter('chat-a');
    expect(manager.isActive('chat-a')).toBe(true);
    expect(manager.isActive('chat-b')).toBe(false);
    const approved = await manager.approve('chat-a', '# Approved');
    expect(approved).toMatchObject({ mode: 'default', approvedPlan: '# Approved', planReference: 'plan-private.md' });
    expect(save).toHaveBeenCalledWith('chat-a', '# Approved');
  });

  it('refuses plan approval outside plan mode', async () => {
    const manager = new ManageAgentPlanMode({ save: async () => ({ reference: 'unused' }) });
    await expect(manager.approve('chat-a', '# Plan')).rejects.toThrow('only');
  });
});
