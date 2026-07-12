import type { IWorkflowNodeExecutor } from '../../domain/ports/IWorkflowNodeExecutor.js';
import type { WorkflowPrimitive } from '../../domain/entities/workflow.js';

export class LocalWorkflowNodeExecutor implements IWorkflowNodeExecutor {
  private readonly handlers: Record<string, () => Promise<WorkflowPrimitive>>;
  constructor(handlers: Record<string, () => Promise<WorkflowPrimitive>>) { this.handlers = handlers; }
  async execute(node: Parameters<IWorkflowNodeExecutor['execute']>[0]) {
    if (node.risk !== 'read') return { ok: false, errorCode: 'parallel_write_not_supported' };
    const handler = this.handlers[node.capabilityId];
    return handler ? { ok: true, result: await handler() } : { ok: false, errorCode: 'unknown_capability' };
  }
}
