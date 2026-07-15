import { describe, expect, it, vi } from 'vitest';
import type { ManageAgentWorkers } from '../usecases/ManageAgentWorkers.js';
import { AgentWorkerToolPlatform } from './AgentWorkerToolPlatform.js';

describe('AgentWorkerToolPlatform', () => {
  it('exposes exact Agent and SendMessage names and returns an addressable background ID', async () => {
    const spawn = vi.fn(async () => ({ background: true as const, worker: {
      id: 'worker-1', name: 'reviewer', description: 'Review auth flow',
    } }));
    const send = vi.fn(async () => ['reviewer: queued']);
    const platform = createPlatform({ spawn, send });
    expect((await platform.list('/workspace')).map((tool) => tool.name)).toEqual(['read_file', 'Agent', 'SendMessage']);
    const launched = await platform.execute('Agent', {
      description: 'Review auth flow', prompt: 'Inspect auth.ts', name: 'reviewer', run_in_background: true,
    }, '/workspace', 'workspace-write');
    expect(launched).toEqual({ ok: true, output: JSON.stringify({ status: 'async_launched', agentId: 'worker-1', name: 'reviewer', description: 'Review auth flow' }) });
    expect(spawn).toHaveBeenCalledOnce();
    const delivered = await platform.execute('SendMessage', {
      to: 'reviewer', summary: 'Please inspect the timeout branch first', message: 'Inspect timeout branch.',
    }, '/workspace', 'workspace-write');
    expect(delivered).toEqual({ ok: true, output: 'reviewer: queued' });
    expect(send).toHaveBeenCalledOnce();
  });

  it('blocks nested background workers but permits synchronous nesting', async () => {
    const spawn = vi.fn(async () => ({ background: false as const, worker: {
      id: 'nested', status: 'completed', result: 'done', completedSteps: 1,
    } }));
    const platform = createPlatform({ spawn, send: vi.fn() }, 'parent-worker');
    const blocked = await platform.execute('Agent', {
      description: 'Run nested review', prompt: 'Review', run_in_background: true,
    }, '/workspace', 'danger-full-access');
    expect(blocked.ok).toBe(false);
    expect(blocked.output).toContain('must run synchronously');
    expect(spawn).not.toHaveBeenCalled();
    const completed = await platform.execute('Agent', {
      description: 'Run nested review', prompt: 'Review', run_in_background: false,
    }, '/workspace', 'danger-full-access');
    expect(completed.ok).toBe(true);
  });
});

function createPlatform(workers: { spawn: ReturnType<typeof vi.fn>; send: ReturnType<typeof vi.fn> }, parentAgentId?: string) {
  return new AgentWorkerToolPlatform(
    { list: async () => [{ name: 'read_file', description: '', risk: 'read', parameters: {} }] },
    { execute: async () => ({ ok: true, output: 'base' }) },
    workers as unknown as ManageAgentWorkers,
    { runner: { run: async () => ({ status: 'completed', completedSteps: 0, result: '' }) }, events: { emitWorker: () => undefined, emitEvent: () => undefined } },
    { parentScopeId: 'scope', ...(parentAgentId ? { parentAgentId } : {}), depth: parentAgentId ? 1 : 0 },
  );
}
