import { app } from 'electron';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { ToolAuditRecord } from '../../domain/entities/tool.js';
import type { IToolAuditLogger } from '../../domain/ports/IToolAuditLogger.js';
import { appendPrivateLine } from '../storage/privateFile.js';

export class JsonlToolAuditLogger implements IToolAuditLogger {
  async record(record: ToolAuditRecord) {
    const auditRecord = {
      ...record,
      workspaceRoot: createHash('sha256').update(record.workspaceRoot).digest('hex').slice(0, 16),
    };
    const targetPath = path.join(app.getPath('userData'), 'tool-audit.jsonl');
    await appendPrivateLine(targetPath, `${JSON.stringify(auditRecord)}\n`);
  }
}
