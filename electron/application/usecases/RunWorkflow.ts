import { assertWorkflowDefinition, type ActionWorkflowNode, type NodeCheckpoint, type NodeExecution, type WorkflowDefinition, type WorkflowEdge, type WorkflowNode } from '../../domain/entities/workflow.js';
import type { IWorkflowCheckpointRepository } from '../../domain/ports/IWorkflowCheckpointRepository.js';
import type { IWorkflowNodeExecutor } from '../../domain/ports/IWorkflowNodeExecutor.js';

export class RunWorkflow {
  private readonly executor: IWorkflowNodeExecutor;
  private readonly checkpoints: IWorkflowCheckpointRepository;
  constructor(executor: IWorkflowNodeExecutor, checkpoints: IWorkflowCheckpointRepository) { this.executor = executor; this.checkpoints = checkpoints; }

  async start(definition: WorkflowDefinition) {
    assertWorkflowDefinition(definition);
    const timestamp = new Date().toISOString();
    const checkpoint: NodeCheckpoint = { runId: crypto.randomUUID(), workflowId: definition.id, workflowVersion: definition.version, status: 'running', currentNodeId: definition.startNodeId, executions: [], createdAt: timestamp, updatedAt: timestamp };
    await this.checkpoints.save(checkpoint);
    return this.advance(definition, checkpoint);
  }

  async resume(definition: WorkflowDefinition, runId: string, approval?: { nodeId: string; approved: boolean }) {
    assertWorkflowDefinition(definition);
    const checkpoint = await this.checkpoints.get(runId);
    if (!checkpoint || checkpoint.workflowId !== definition.id || checkpoint.workflowVersion !== definition.version) throw new Error('Workflow checkpoint does not match this definition version.');
    if (checkpoint.status === 'completed' || checkpoint.status === 'failed') return checkpoint;
    return this.advance(definition, { ...checkpoint, status: 'running' }, approval);
  }

  list(limit?: number) { return this.checkpoints.list(limit); }

  private async advance(definition: WorkflowDefinition, initial: NodeCheckpoint, approval?: { nodeId: string; approved: boolean }) {
    let checkpoint = structuredClone(initial);
    const nodes = new Map(definition.nodes.map((node) => [node.id, node]));
    while (checkpoint.currentNodeId) {
      const node = nodes.get(checkpoint.currentNodeId);
      if (!node) throw new Error('Workflow checkpoint points to an unknown node.');
      const outcome = await this.executeNode(node, nodes, checkpoint, approval);
      checkpoint = outcome.checkpoint;
      if (outcome.pause || checkpoint.status === 'failed') return this.persist(checkpoint);
      const next = this.nextEdge(definition.edges, node, checkpoint);
      checkpoint.currentNodeId = next?.to;
      checkpoint.status = next ? 'running' : 'completed';
      checkpoint.updatedAt = new Date().toISOString();
      await this.checkpoints.save(checkpoint);
      approval = undefined;
    }
    return checkpoint;
  }

  private async executeNode(node: WorkflowNode, nodes: Map<string, WorkflowNode>, checkpoint: NodeCheckpoint, approval?: { nodeId: string; approved: boolean }) {
    if (node.kind === 'approval') return this.executeApproval(node, checkpoint, approval);
    if (node.kind === 'branch') {
      const value = latestExecution(checkpoint, node.condition.sourceNodeId)?.result;
      return { checkpoint: withExecution(checkpoint, execution(node.id, value === node.condition.equals, 'succeeded', 1)), pause: false };
    }
    if (node.kind === 'parallel') {
      const children = node.childNodeIds.map((id) => nodes.get(id) as ActionWorkflowNode);
      const childExecutions = await Promise.all(children.map((child) => this.executeAction(child)));
      checkpoint = childExecutions.reduce(withExecution, checkpoint);
      const failed = childExecutions.some((item) => item.status === 'failed');
      checkpoint = withExecution(checkpoint, execution(node.id, !failed, failed ? 'failed' : 'succeeded', 1));
      if (failed) checkpoint.status = 'failed';
      return { checkpoint, pause: false };
    }
    const actionExecution = await this.executeAction(node);
    checkpoint = withExecution(checkpoint, actionExecution);
    if (actionExecution.status === 'failed') checkpoint.status = 'failed';
    return { checkpoint, pause: false };
  }

  private async executeAction(node: ActionWorkflowNode): Promise<NodeExecution> {
    const startedAt = new Date().toISOString();
    const maxAttempts = node.retry?.maxAttempts ?? 1;
    let last: Awaited<ReturnType<IWorkflowNodeExecutor['execute']>> = { ok: false, errorCode: 'not_started' };
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      last = await this.executor.execute(structuredClone(node));
      if (last.ok) return { nodeId: node.id, status: 'succeeded', attempts: attempt, startedAt, endedAt: new Date().toISOString(), result: last.result };
      if (attempt < maxAttempts && node.retry?.backoffMs) await delay(node.retry.backoffMs);
    }
    return { nodeId: node.id, status: 'failed', attempts: maxAttempts, startedAt, endedAt: new Date().toISOString(), errorCode: sanitizeErrorCode(last.errorCode) };
  }

  private executeApproval(node: Extract<WorkflowNode, { kind: 'approval' }>, checkpoint: NodeCheckpoint, approval?: { nodeId: string; approved: boolean }) {
    const startedAt = latestExecution(checkpoint, node.id)?.startedAt ?? new Date().toISOString();
    if (!approval || approval.nodeId !== node.id) {
      const next = withExecution(checkpoint, { nodeId: node.id, status: 'awaiting_approval', attempts: 1, startedAt });
      next.status = 'paused';
      return { checkpoint: next, pause: true };
    }
    const status = approval.approved ? 'succeeded' as const : 'denied' as const;
    const next = withExecution(checkpoint, { nodeId: node.id, status, attempts: 1, startedAt, endedAt: new Date().toISOString(), result: approval.approved });
    if (!approval.approved) next.status = 'failed';
    return { checkpoint: next, pause: false };
  }

  private nextEdge(edges: WorkflowEdge[], node: WorkflowNode, checkpoint: NodeCheckpoint) {
    const outgoing = edges.filter((edge) => edge.from === node.id);
    if (node.kind !== 'branch') {
      if (outgoing.length > 1) throw new Error('Non-branch node has multiple outgoing edges.');
      return outgoing[0];
    }
    return outgoing.find((edge) => edge.when === String(Boolean(latestExecution(checkpoint, node.id)?.result)));
  }

  private async persist(checkpoint: NodeCheckpoint) { checkpoint.updatedAt = new Date().toISOString(); await this.checkpoints.save(checkpoint); return checkpoint; }
}

function withExecution(checkpoint: NodeCheckpoint, next: NodeExecution) { return { ...checkpoint, executions: [...checkpoint.executions.filter((item) => item.nodeId !== next.nodeId), next], updatedAt: new Date().toISOString() }; }
function latestExecution(checkpoint: NodeCheckpoint, nodeId: string) { return checkpoint.executions.find((item) => item.nodeId === nodeId); }
function execution(nodeId: string, result: boolean, status: 'succeeded' | 'failed', attempts: number): NodeExecution { const timestamp = new Date().toISOString(); return { nodeId, status, attempts, startedAt: timestamp, endedAt: timestamp, result }; }
function sanitizeErrorCode(value: string | undefined) { return (value || 'capability_failed').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80); }
function delay(milliseconds: number) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
