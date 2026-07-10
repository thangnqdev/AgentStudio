import type { ToolAuditRecord } from '../entities/tool.js';

export interface IToolAuditLogger {
  record(event: ToolAuditRecord): Promise<void>;
}
