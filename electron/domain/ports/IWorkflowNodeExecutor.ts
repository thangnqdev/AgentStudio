import type { ActionWorkflowNode, WorkflowPrimitive } from '../entities/workflow.js';

export interface IWorkflowNodeExecutor {
  execute(node: Readonly<ActionWorkflowNode>): Promise<{ ok: boolean; result?: WorkflowPrimitive; errorCode?: string }>;
}
