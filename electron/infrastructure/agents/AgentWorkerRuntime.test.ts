import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AgentWorkerCheckpoint, AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import { FixedWorkspaceToolPlatform } from '../../application/services/FixedWorkspaceToolPlatform.js';
import { RunAgentSession } from '../../application/usecases/RunAgentSession.js';
import { ManageAgentWorktrees } from '../../application/usecases/ManageAgentWorktrees.js';
import { AttachmentMessageFormatter } from '../ai/AttachmentMessageFormatter.js';
import { MemoryEvaluationWorktreeSessionRepository, ScriptedEvaluationWorktreeGateway } from '../evaluation/ScriptedEvaluationWorktreeAdapters.js';
import { ScriptedEvaluationProvider } from '../evaluation/ScriptedEvaluationProvider.js';
import { AgentToolExecutor } from '../tools/AgentToolExecutor.js';
import { AgentWorkerRuntime } from './AgentWorkerRuntime.js';

let workspace = '';
let worktreeRoot = '';
beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-worker-runtime-'));
  worktreeRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'agentstudio-worker-worktree-'));
});
afterEach(async () => {
  await Promise.all([fs.rm(workspace, { recursive: true, force: true }), fs.rm(worktreeRoot, { recursive: true, force: true })]);
});

describe('AgentWorkerRuntime', () => {
  it('uses the production session and full tool path to edit an isolated worktree', async () => {
    const provider = new ScriptedEvaluationProvider([
      { toolCalls: [{ name: 'write_file', args: { path: 'worker.txt', content: 'created by worker\n' } }] },
      { content: 'Worker completed the isolated edit.' },
    ]);
    const worktrees = new ManageAgentWorktrees(
      new ScriptedEvaluationWorktreeGateway(worktreeRoot), new MemoryEvaluationWorktreeSessionRepository(),
    );
    const events = { emitWorker: vi.fn(), emitEvent: vi.fn() };
    const runtime = new AgentWorkerRuntime(
      { baseUrl: 'scripted://worker', apiKey: '', model: 'scripted', permissionMode: 'danger-full-access' },
      worktrees,
      async (_worker, root) => {
        const base = new AgentToolExecutor({ provider: 'disabled' });
        const platform = new FixedWorkspaceToolPlatform(base, base, root);
        const session = new RunAgentSession(
          provider, platform, platform, new AttachmentMessageFormatter(),
          { requestApproval: async () => true }, { record: async () => undefined },
          { newSpanId: () => 'span', startTrace: async () => undefined, updateTrace: async () => undefined, recordSpan: async () => 'span' },
        );
        return { session, toolPlatform: platform };
      },
      events,
    );
    let checkpoint: AgentWorkerCheckpoint | undefined;
    const result = await runtime.run(worker(), {
      checkpoint: async (value) => { checkpoint = structuredClone(value); }, drainMessages: async () => [],
    }, new AbortController().signal);
    provider.assertComplete();
    expect(result).toMatchObject({ status: 'completed', result: 'Worker completed the isolated edit.' });
    expect(result.worktreePath).toBeTruthy();
    expect(await fs.readFile(path.join(result.worktreePath!, 'worker.txt'), 'utf8')).toBe('created by worker\n');
    await expect(fs.stat(path.join(workspace, 'worker.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(checkpoint).toMatchObject({ status: 'completed', completedSteps: 1 });
  });
});

function worker(): AgentWorkerRecord {
  return {
    id: 'worker-1', traceId: 'trace-1', parentScopeId: 'scope-1', name: 'writer', description: 'Create isolated proof',
    prompt: 'Create worker.txt', permissionMode: 'danger-full-access', isolation: 'worktree', workspaceRoot: workspace,
    depth: 1, background: false, status: 'running', createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z',
    completedSteps: 0, messages: [{ id: 'prompt', sender: 'user', content: 'Create worker.txt' }], conversation: [],
  };
}
