import { describe, expect, it, vi } from 'vitest';
import { LifecycleAwareAgentSession } from './LifecycleAwareAgentSession.js';

describe('LifecycleAwareAgentSession', () => {
  it('dispatches Stop then SessionEnd without changing a successful result', async () => {
    const events: string[] = [];
    const session = { execute: vi.fn(async () => ({ status: 'completed' as const, completedSteps: 2 })) };
    const wrapped = new LifecycleAwareAgentSession(session, hooks(events), {
      workspaceRoot: () => '/workspace', requestId: 'request-1', taskId: 'task-1',
    });
    await expect(wrapped.execute()).resolves.toEqual({ status: 'completed', completedSteps: 2 });
    expect(events).toEqual(['Stop', 'SessionEnd']);
  });

  it('dispatches StopFailure and SessionEnd before preserving the session error', async () => {
    const events: string[] = [];
    const session = { execute: vi.fn(async () => { throw new Error('provider failed'); }) };
    const wrapped = new LifecycleAwareAgentSession(session, hooks(events), {
      workspaceRoot: () => '/workspace', requestId: 'request-1',
    });
    await expect(wrapped.execute()).rejects.toThrow('provider failed');
    expect(events).toEqual(['StopFailure', 'SessionEnd']);
  });
});

function hooks(events: string[]) {
  return { dispatch: async (input: { event: string }) => {
    events.push(input.event);
    return { matchedHookIds: [], contexts: [], auditLabels: [] };
  } };
}
