import { describe, expect, it } from 'vitest';
import { assertNodeCheckpoint, assertWorkflowDefinition, type NodeCheckpoint, type WorkflowDefinition } from './workflow.js';

describe('workflow invariants', () => {
  it('accepts sequence, branch, retry, approval and parallel read-only nodes', () => {
    expect(() => assertWorkflowDefinition(workflow())).not.toThrow();
  });

  it('rejects cycles and parallel write nodes', () => {
    const cyclic = workflow(); cyclic.edges.push({ from: 'done', to: 'start' });
    expect(() => assertWorkflowDefinition(cyclic)).toThrow('acyclic');
    const unsafe = workflow(); (unsafe.nodes.find((node) => node.id === 'read-b') as { risk: string }).risk = 'write';
    expect(() => assertWorkflowDefinition(unsafe)).toThrow('read-only');
  });

  it('rejects checkpoint content outside the operational allow-list', () => {
    const checkpoint: NodeCheckpoint = { runId: 'run', workflowId: 'test', workflowVersion: '1.0.0', status: 'running', currentNodeId: 'start', executions: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
    expect(() => assertNodeCheckpoint(checkpoint)).not.toThrow();
    expect(() => assertNodeCheckpoint({ ...checkpoint, prompt: 'private' } as NodeCheckpoint)).toThrow('non-allow-listed');
  });
});

function workflow(): WorkflowDefinition {
  return {
    id: 'test', version: '1.0.0', name: 'Test', startNodeId: 'start',
    nodes: [
      { id: 'start', label: 'Start', kind: 'action', capabilityId: 'start', risk: 'read', retry: { maxAttempts: 2, backoffMs: 0 } },
      { id: 'parallel', label: 'Parallel', kind: 'parallel', childNodeIds: ['read-a', 'read-b'] },
      { id: 'read-a', label: 'A', kind: 'action', capabilityId: 'a', risk: 'read' }, { id: 'read-b', label: 'B', kind: 'action', capabilityId: 'b', risk: 'read' },
      { id: 'branch', label: 'Branch', kind: 'branch', condition: { sourceNodeId: 'read-a', equals: true } },
      { id: 'approval', label: 'Approval', kind: 'approval', summary: 'Approve' },
      { id: 'done', label: 'Done', kind: 'action', capabilityId: 'done', risk: 'read' }, { id: 'blocked', label: 'Blocked', kind: 'action', capabilityId: 'blocked', risk: 'read' },
    ],
    edges: [{ from: 'start', to: 'parallel' }, { from: 'parallel', to: 'branch' }, { from: 'branch', to: 'approval', when: 'true' }, { from: 'branch', to: 'blocked', when: 'false' }, { from: 'approval', to: 'done' }],
  };
}
