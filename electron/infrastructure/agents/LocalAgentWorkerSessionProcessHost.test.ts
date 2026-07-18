import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import { LocalAgentWorkerSessionProcessHost } from './LocalAgentWorkerSessionProcessHost.js';

const directories: string[] = [];
afterEach(async () => { delete process.env.UNSAFE_AGENT_SECRET; await Promise.all(directories.splice(0).map((item) => fs.rm(item, { recursive: true, force: true }))); });

describe('LocalAgentWorkerSessionProcessHost', () => {
  it('runs authenticated session RPC over a filtered child process boundary', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-worker-process-')); directories.push(cwd);
    const entry = fileURLToPath(new URL('./fixtures/worker-session-client.mjs', import.meta.url));
    const host = new LocalAgentWorkerSessionProcessHost(entry);
    const emit = vi.fn(); const checkpoint = vi.fn(async () => undefined); const dispatchHook = vi.fn(async () => undefined); const runTool = vi.fn(async () => ({
      stepContent: 'ok', toolMessage: { role: 'tool' as const, tool_call_id: 'call-1', content: '{"ok":true}' },
    }));
    process.env.UNSAFE_AGENT_SECRET = 'must-not-cross-process';
    const result = await host.run({
      cwd,
      bootstrap: {
        worker: worker(cwd), workspaceRoot: cwd, guidanceContext: 'trusted profile',
        settings: { baseUrl: 'https://example.test/v1', apiKey: 'private-key', model: 'model', permissionMode: 'workspace-write' },
      },
    }, {
      listTools: async () => [{ name: 'read_file', description: 'read', risk: 'read', parameters: { type: 'object' } }],
      runTool, checkpoint, drainMessages: async () => [], dispatchHook, recordSpan: async () => 'span-1', emit,
    }, new AbortController().signal);
    expect(result).toEqual({ status: 'completed', completedSteps: 1 });
    expect(runTool).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'worker-1', step: 0 }));
    expect(checkpoint).toHaveBeenCalledWith(expect.objectContaining({ id: 'worker-1', completedSteps: 1 }));
    expect(dispatchHook.mock.calls).toEqual([['PreCompact'], ['PostCompact']]);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ event: 'chunk', value: 'child-complete' }));
  });
});

function worker(workspaceRoot: string): AgentWorkerRecord {
  return {
    id: 'worker-1', traceId: 'trace-1', parentScopeId: 'scope-1', description: 'test child', prompt: 'work',
    permissionMode: 'workspace-write', workspaceRoot, depth: 1, background: true, status: 'running',
    createdAt: '2026-07-16T00:00:00.000Z', updatedAt: '2026-07-16T00:00:00.000Z', completedSteps: 0,
    messages: [{ id: 'prompt-1', sender: 'user', content: 'work' }], conversation: [],
  };
}
