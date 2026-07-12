export type WorkflowRisk = 'read' | 'write' | 'execute' | 'network';
export type WorkflowPrimitive = string | number | boolean | null;
export type RetryPolicy = { maxAttempts: number; backoffMs: number };

type WorkflowNodeBase = { id: string; label: string };
export type ActionWorkflowNode = WorkflowNodeBase & { kind: 'action'; capabilityId: string; risk: WorkflowRisk; input?: Record<string, WorkflowPrimitive>; retry?: RetryPolicy };
export type BranchWorkflowNode = WorkflowNodeBase & { kind: 'branch'; condition: { sourceNodeId: string; equals: WorkflowPrimitive } };
export type ApprovalWorkflowNode = WorkflowNodeBase & { kind: 'approval'; summary: string };
export type ParallelWorkflowNode = WorkflowNodeBase & { kind: 'parallel'; childNodeIds: string[] };
export type WorkflowNode = ActionWorkflowNode | BranchWorkflowNode | ApprovalWorkflowNode | ParallelWorkflowNode;
export type WorkflowEdge = { from: string; to: string; when?: 'true' | 'false' };
export type WorkflowDefinition = { id: string; version: string; name: string; startNodeId: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] };

export type NodeExecution = {
  nodeId: string; status: 'running' | 'succeeded' | 'failed' | 'denied' | 'awaiting_approval'; attempts: number;
  startedAt: string; endedAt?: string; result?: WorkflowPrimitive; errorCode?: string;
};
export type NodeCheckpoint = {
  runId: string; workflowId: string; workflowVersion: string; status: 'running' | 'paused' | 'completed' | 'failed';
  currentNodeId?: string; executions: NodeExecution[]; createdAt: string; updatedAt: string;
};

export function assertWorkflowDefinition(definition: WorkflowDefinition) {
  if (!definition.id || !definition.version || !definition.startNodeId || !definition.nodes.length) throw new Error('Workflow identity is incomplete.');
  const nodes = new Map(definition.nodes.map((node) => [node.id, node]));
  if (nodes.size !== definition.nodes.length || !nodes.has(definition.startNodeId)) throw new Error('Workflow nodes must be unique and include the start node.');
  for (const edge of definition.edges) if (!nodes.has(edge.from) || !nodes.has(edge.to)) throw new Error('Workflow edge references an unknown node.');
  const parallelChildren = new Set<string>();
  for (const node of definition.nodes) {
    if (node.kind === 'action' && node.retry && (!Number.isInteger(node.retry.maxAttempts) || node.retry.maxAttempts < 1 || node.retry.maxAttempts > 5 || node.retry.backoffMs < 0 || node.retry.backoffMs > 30_000)) throw new Error('Workflow retry policy is out of bounds.');
    const outgoing = definition.edges.filter((edge) => edge.from === node.id);
    if (node.kind !== 'branch' && (outgoing.length > 1 || outgoing.some((edge) => edge.when !== undefined))) throw new Error('Only branch nodes may have conditional or multiple outgoing edges.');
    if (node.kind === 'branch') {
      if (!nodes.has(node.condition.sourceNodeId)) throw new Error('Branch condition references an unknown node.');
      if (outgoing.filter((edge) => edge.when === 'true').length !== 1 || outgoing.filter((edge) => edge.when === 'false').length !== 1) throw new Error('Branch node requires one true and one false edge.');
    }
    if (node.kind === 'parallel') {
      if (node.childNodeIds.length < 2) throw new Error('Parallel node requires at least two children.');
      for (const childId of node.childNodeIds) {
      const child = nodes.get(childId);
      if (!child || child.kind !== 'action' || child.risk !== 'read' || parallelChildren.has(childId)) throw new Error('Parallel children must be unique read-only action nodes.');
      parallelChildren.add(childId);
      }
    }
  }
  if (parallelChildren.has(definition.startNodeId) || definition.edges.some((edge) => parallelChildren.has(edge.from) || parallelChildren.has(edge.to))) throw new Error('Parallel child nodes cannot be independently scheduled.');
  assertAcyclic(definition, parallelChildren);
}

export function assertNodeCheckpoint(checkpoint: NodeCheckpoint) {
  assertOnlyKeys(checkpoint, ['runId', 'workflowId', 'workflowVersion', 'status', 'currentNodeId', 'executions', 'createdAt', 'updatedAt']);
  if (!checkpoint.runId || !checkpoint.workflowId || !checkpoint.workflowVersion || !['running', 'paused', 'completed', 'failed'].includes(checkpoint.status) || !Number.isFinite(Date.parse(checkpoint.createdAt)) || !Number.isFinite(Date.parse(checkpoint.updatedAt))) throw new Error('Workflow checkpoint invariant failed.');
  const nodeIds = new Set<string>();
  for (const execution of checkpoint.executions) {
    assertOnlyKeys(execution, ['nodeId', 'status', 'attempts', 'startedAt', 'endedAt', 'result', 'errorCode']);
    if (!execution.nodeId || nodeIds.has(execution.nodeId) || !['running', 'succeeded', 'failed', 'denied', 'awaiting_approval'].includes(execution.status) || !Number.isInteger(execution.attempts) || execution.attempts < 1 || execution.attempts > 5 || !Number.isFinite(Date.parse(execution.startedAt)) || (execution.endedAt !== undefined && !Number.isFinite(Date.parse(execution.endedAt)))) throw new Error('Node execution invariant failed.');
    if (typeof execution.result === 'string' && execution.result.length > 256) throw new Error('Workflow result exceeds the primitive metadata limit.');
    if (execution.result !== undefined && execution.result !== null && typeof execution.result !== 'string' && typeof execution.result !== 'number' && typeof execution.result !== 'boolean') throw new Error('Workflow result must be primitive metadata.');
    if (typeof execution.result === 'number' && !Number.isFinite(execution.result)) throw new Error('Workflow numeric result must be finite.');
    if (execution.errorCode && !/^[a-zA-Z0-9_.-]{1,80}$/.test(execution.errorCode)) throw new Error('Workflow error code is invalid.');
    nodeIds.add(execution.nodeId);
  }
}

function assertOnlyKeys(value: object, keys: string[]) { const allowed = new Set(keys); if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error('Workflow state contains non-allow-listed data.'); }

function assertAcyclic(definition: WorkflowDefinition, ignored: Set<string>) {
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (nodeId: string) => {
    if (visiting.has(nodeId)) throw new Error('Workflow graph must be acyclic.');
    if (visited.has(nodeId) || ignored.has(nodeId)) return;
    visiting.add(nodeId);
    for (const edge of definition.edges.filter((item) => item.from === nodeId)) visit(edge.to);
    visiting.delete(nodeId); visited.add(nodeId);
  };
  for (const node of definition.nodes) visit(node.id);
}
