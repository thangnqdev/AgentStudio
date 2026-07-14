import { app } from 'electron';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { ILifecycleHookAuditLogger, LifecycleHookAuditRecord } from '../../domain/ports/ILifecycleHookAuditLogger.js';
import { appendPrivateLine } from '../storage/privateFile.js';

export class JsonlLifecycleHookAuditLogger implements ILifecycleHookAuditLogger {
  async record(record: LifecycleHookAuditRecord) {
    const bounded = {
      ...record,
      hookIds: record.hookIds.slice(0, 100),
      labels: record.labels.slice(0, 100),
      workspaceRoot: createHash('sha256').update(record.workspaceRoot).digest('hex').slice(0, 16),
    };
    const targetPath = path.join(app.getPath('userData'), 'lifecycle-hook-audit.jsonl');
    await appendPrivateLine(targetPath, `${JSON.stringify(bounded)}\n`);
  }
}
