import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentWorkerCheckpoint, AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import type { IAgentWorkerSessionProcessHost } from '../../domain/ports/IAgentWorkerSessionProcessHost.js';
import { AgentToolCallRunner } from '../../application/services/AgentToolCallRunner.js';
import { ManageAgentWorktrees } from '../../application/usecases/ManageAgentWorktrees.js';
import { FixedWorkspaceToolPlatform } from '../../application/services/FixedWorkspaceToolPlatform.js';
import { MemoryEvaluationWorktreeSessionRepository, ScriptedEvaluationWorktreeGateway } from '../evaluation/ScriptedEvaluationWorktreeAdapters.js';
import { AgentToolExecutor } from '../tools/AgentToolExecutor.js';
import { ProcessIsolatedAgentWorkerRuntime } from './ProcessIsolatedAgentWorkerRuntime.js';

let workspace = ''; let worktreeRoot = '';
beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-process-worker-'));
  worktreeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-process-worktree-'));
});
afterEach(async () => Promise.all([fs.rm(workspace, { recursive: true, force: true }), fs.rm(worktreeRoot, { recursive: true, force: true })]));

describe('ProcessIsolatedAgentWorkerRuntime', () => {
  it('keeps tools and checkpoints in the parent while the session loop runs through the process host', async () => {
    const host: IAgentWorkerSessionProcessHost = {
      run: async (input, callbacks) => {
        expect(input.bootstrap.settings.apiKey).toBe('secret');
        expect((await callbacks.listTools()).some((tool) => tool.name === 'write_file')).toBe(true);
        await callbacks.runTool({
          requestId: input.bootstrap.worker.id, step: 0,
          toolCall: { id: 'call-1', function: { name: 'write_file', arguments: '{"path":"proof.txt","content":"isolated\\n"}' } },
        });
        callbacks.emit({ kind: 'event', event: 'chunk', requestId: input.bootstrap.worker.id, value: 'Process worker completed.' });
        await callbacks.dispatchHook('PreCompact');
        await callbacks.dispatchHook('PostCompact');
        await callbacks.checkpoint({
          id: input.bootstrap.worker.id, traceId: input.bootstrap.worker.traceId,
          workspaceRoot: input.bootstrap.worker.workspaceRoot, status: 'completed', completedSteps: 1,
          messages: input.bootstrap.worker.messages, conversation: [],
        });
        return { status: 'completed' as const, completedSteps: 1 };
      },
    };
    const worktrees = new ManageAgentWorktrees(
      new ScriptedEvaluationWorktreeGateway(worktreeRoot), new MemoryEvaluationWorktreeSessionRepository(),
    );
    const events = { emitWorker: vi.fn(), emitEvent: vi.fn() };
    const tracer = { newSpanId: () => 'span', startTrace: async () => undefined, updateTrace: async () => undefined, recordSpan: async () => 'span' };
    const dispatch = vi.fn(async (_input: { event: string; workspaceRoot: string; requestId?: string; taskId?: string }) => (
      { matchedHookIds: [], contexts: [], auditLabels: [] }
    ));
    const runtime = new ProcessIsolatedAgentWorkerRuntime(
      { baseUrl: 'https://example.test', apiKey: 'secret', model: 'model', permissionMode: 'danger-full-access' },
      worktrees,
      async (_worker, root) => {
        const base = new AgentToolExecutor({ provider: 'disabled' });
        const platform = new FixedWorkspaceToolPlatform(base, base, root);
        return {
          toolPlatform: platform,
          toolRunner: new AgentToolCallRunner(platform, { requestApproval: async () => true }, { record: async () => undefined }, tracer),
          hooks: { dispatch },
        };
      },
      events, host, tracer,
    );
    let checkpoint: AgentWorkerCheckpoint | undefined;
    const result = await runtime.run(worker(), {
      checkpoint: async (value) => { checkpoint = value; }, drainMessages: async () => [],
    }, new AbortController().signal);
    expect(result).toMatchObject({ status: 'completed', completedSteps: 1, result: 'Process worker completed.' });
    expect(checkpoint).toMatchObject({ status: 'completed', completedSteps: 1 });
    expect(result.worktreePath).toBeTruthy();
    expect(await fs.readFile(path.join(result.worktreePath!, 'proof.txt'), 'utf8')).toBe('isolated\n');
    expect(dispatch.mock.calls.map(([input]) => input)).toEqual([
      expect.objectContaining({ event: 'PreCompact', requestId: 'worker-1', taskId: 'worker-1' }),
      expect.objectContaining({ event: 'PostCompact', requestId: 'worker-1', taskId: 'worker-1' }),
    ]);
  });
});

function worker(): AgentWorkerRecord {
  return {
    id: 'worker-1', traceId: 'trace-1', parentScopeId: 'scope-1', name: 'writer', description: 'Create proof', prompt: 'work',
    permissionMode: 'danger-full-access', isolation: 'worktree', workspaceRoot: workspace, depth: 1, background: true,
    status: 'running', createdAt: '2026-07-16T00:00:00.000Z', updatedAt: '2026-07-16T00:00:00.000Z', completedSteps: 0,
    messages: [{ id: 'prompt', sender: 'user', content: 'work' }], conversation: [],
  };
}
