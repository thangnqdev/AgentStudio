import type { WorkflowDefinition } from '../domain/entities/workflow.js';

export const LOCAL_READINESS_WORKFLOW: WorkflowDefinition = {
  id: 'local-readiness', version: '1.0.0', name: 'Local Agent Readiness', startNodeId: 'workspace',
  nodes: [
    { id: 'workspace', label: 'Check workspace', kind: 'action', capabilityId: 'workspace.available', risk: 'read', retry: { maxAttempts: 2, backoffMs: 100 } },
    { id: 'parallel-checks', label: 'Run read-only checks', kind: 'parallel', childNodeIds: ['provider', 'knowledge'] },
    { id: 'provider', label: 'Check provider', kind: 'action', capabilityId: 'provider.configured', risk: 'read' },
    { id: 'knowledge', label: 'Check knowledge', kind: 'action', capabilityId: 'knowledge.available', risk: 'read' },
    { id: 'provider-branch', label: 'Provider ready?', kind: 'branch', condition: { sourceNodeId: 'provider', equals: true } },
    { id: 'approval', label: 'Confirm readiness', kind: 'approval', summary: 'Confirm the local agent readiness result.' },
    { id: 'ready', label: 'Ready', kind: 'action', capabilityId: 'workflow.ready', risk: 'read' },
    { id: 'blocked', label: 'Blocked', kind: 'action', capabilityId: 'workflow.blocked', risk: 'read' },
  ],
  edges: [
    { from: 'workspace', to: 'parallel-checks' }, { from: 'parallel-checks', to: 'provider-branch' },
    { from: 'provider-branch', to: 'approval', when: 'true' }, { from: 'provider-branch', to: 'blocked', when: 'false' },
    { from: 'approval', to: 'ready' },
  ],
};
