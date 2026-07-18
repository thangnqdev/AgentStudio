import { describe, expect, it } from 'vitest';
import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import { LifecycleAwareAgentWorkerRunner } from './LifecycleAwareAgentWorkerRunner.js';

const worker: AgentWorkerRecord = {
  id: 'worker-1', traceId: 'trace-1', parentScopeId: 'scope-1', name: 'reviewer',
  description: 'Review changes', prompt: 'Review', permissionMode: 'read-only', workspaceRoot: '/workspace',
  depth: 1, background: true, status: 'running', createdAt: '2026-07-18T00:00:00.000Z',
  updatedAt: '2026-07-18T00:00:00.000Z', completedSteps: 0, messages: [], conversation: [],
};

describe('LifecycleAwareAgentWorkerRunner', () => {
  it('dispatches matched start and stop events around a successful worker', async () => {
    const events: Array<{ event: string; matchValue?: string }> = [];
    const runner = new LifecycleAwareAgentWorkerRunner(
      { run: async () => ({ status: 'completed', completedSteps: 1, result: 'done' }) },
      { dispatch: async (input) => { events.push(input); return emptyResult(); } },
    );
    await expect(runner.run(worker, callbacks(), new AbortController().signal)).resolves.toMatchObject({ result: 'done' });
    expect(events).toEqual([
      expect.objectContaining({ event: 'SubagentStart', matchValue: 'reviewer' }),
      expect.objectContaining({ event: 'SubagentStop', matchValue: 'reviewer' }),
    ]);
  });

  it('still dispatches SubagentStop when the worker fails', async () => {
    const events: string[] = [];
    const runner = new LifecycleAwareAgentWorkerRunner(
      { run: async () => { throw new Error('worker failed'); } },
      { dispatch: async (input) => { events.push(input.event); return emptyResult(); } },
    );
    await expect(runner.run(worker, callbacks(), new AbortController().signal)).rejects.toThrow('worker failed');
    expect(events).toEqual(['SubagentStart', 'SubagentStop']);
  });
});

function callbacks() { return { checkpoint: async () => undefined, drainMessages: async () => [] }; }
function emptyResult() { return { matchedHookIds: [], contexts: [], auditLabels: [] }; }
