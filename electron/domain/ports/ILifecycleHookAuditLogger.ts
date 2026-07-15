import type { IntegratedLifecycleHookEvent } from '../entities/lifecycleHook.js';

export type LifecycleHookAuditRecord = {
  event: IntegratedLifecycleHookEvent;
  hookIds: string[];
  labels: string[];
  requestId?: string;
  toolName?: string;
  taskId?: string;
  timestamp: string;
  workspaceRoot: string;
};

export interface ILifecycleHookAuditLogger {
  record(record: LifecycleHookAuditRecord): Promise<void>;
}
