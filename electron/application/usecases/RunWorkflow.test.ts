import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { ActionWorkflowNode, WorkflowDefinition } from '../../domain/entities/workflow.js';
import { JsonWorkflowCheckpointRepository } from '../../infrastructure/workflows/JsonWorkflowCheckpointRepository.js';
import { RunWorkflow } from './RunWorkflow.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));

describe('RunWorkflow integration', () => {
  it('retries, branches, runs parallel reads, pauses for approval and resumes without replay', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'workflow-')); directories.push(directory);
    const calls = new Map<string, number>(); let activeReads = 0; let maxParallelReads = 0;
    const executor = { execute: async (node: Readonly<ActionWorkflowNode>) => {
      calls.set(node.id, (calls.get(node.id) ?? 0) + 1);
      if (node.id === 'start' && calls.get(node.id) === 1) return { ok: false, errorCode: 'transient' };
      if (node.id === 'read-a' || node.id === 'read-b') { activeReads += 1; maxParallelReads = Math.max(maxParallelReads, activeReads); await new Promise((resolve) => setTimeout(resolve, 5)); activeReads -= 1; }
      return { ok: true, result: node.id === 'blocked' ? false : true };
    } };
    const repository = new JsonWorkflowCheckpointRepository(path.join(directory, 'checkpoints.json'));
    const runtime = new RunWorkflow(executor, repository);
    const paused = await runtime.start(definition());
    expect(paused.status).toBe('paused'); expect(paused.currentNodeId).toBe('approval');
    expect(paused.executions.find((item) => item.nodeId === 'start')?.attempts).toBe(2);
    expect(maxParallelReads).toBe(2);
    const completed = await runtime.resume(definition(), paused.runId, { nodeId: 'approval', approved: true });
    expect(completed.status).toBe('completed'); expect(calls.get('start')).toBe(2); expect(calls.get('read-a')).toBe(1); expect(calls.get('done')).toBe(1);
    expect((await repository.get(paused.runId))?.status).toBe('completed');
  });

  it('fails durably when approval is denied', async () => {
    const checkpoints = new MemoryCheckpoints();
    const runtime = new RunWorkflow({ execute: async (node) => ({ ok: true, result: node.id !== 'blocked' }) }, checkpoints);
    const paused = await runtime.start(definition());
    const denied = await runtime.resume(definition(), paused.runId, { nodeId: 'approval', approved: false });
    expect(denied.status).toBe('failed');
    expect(denied.executions.find((item) => item.nodeId === 'approval')?.status).toBe('denied');
  });

  it('uses bounded optimizer retries only when a node has no explicit policy', async () => {
    const checkpoints = new MemoryCheckpoints(); let attempts = 0; const tuned = definition();
    delete (tuned.nodes.find((node) => node.id === 'start') as ActionWorkflowNode).retry;
    const runtime = new RunWorkflow({ execute: async (node) => { if (node.id === 'start' && attempts++ === 0) return { ok: false, errorCode: 'transient' }; return { ok: true, result: true }; } }, checkpoints, async () => 1);
    const paused = await runtime.start(tuned);
    expect(paused.executions.find((item) => item.nodeId === 'start')?.attempts).toBe(2);
  });
});

class MemoryCheckpoints {
  values = new Map<string, Awaited<ReturnType<RunWorkflow['start']>>>();
  async save(value: Awaited<ReturnType<RunWorkflow['start']>>) { this.values.set(value.runId, structuredClone(value)); }
  async get(runId: string) { return this.values.get(runId) ?? null; }
  async list() { return [...this.values.values()]; }
}

function definition(): WorkflowDefinition {
  return { id: 'integration', version: '1.0.0', name: 'Integration', startNodeId: 'start', nodes: [
    { id: 'start', label: 'Start', kind: 'action', capabilityId: 'start', risk: 'read', retry: { maxAttempts: 2, backoffMs: 0 } },
    { id: 'parallel', label: 'Parallel', kind: 'parallel', childNodeIds: ['read-a', 'read-b'] },
    { id: 'read-a', label: 'A', kind: 'action', capabilityId: 'a', risk: 'read' }, { id: 'read-b', label: 'B', kind: 'action', capabilityId: 'b', risk: 'read' },
    { id: 'branch', label: 'Branch', kind: 'branch', condition: { sourceNodeId: 'read-a', equals: true } }, { id: 'approval', label: 'Approval', kind: 'approval', summary: 'Approve' },
    { id: 'done', label: 'Done', kind: 'action', capabilityId: 'done', risk: 'read' }, { id: 'blocked', label: 'Blocked', kind: 'action', capabilityId: 'blocked', risk: 'read' },
  ], edges: [{ from: 'start', to: 'parallel' }, { from: 'parallel', to: 'branch' }, { from: 'branch', to: 'approval', when: 'true' }, { from: 'branch', to: 'blocked', when: 'false' }, { from: 'approval', to: 'done' }] };
}
