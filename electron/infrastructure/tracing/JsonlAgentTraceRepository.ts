import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assertValidTraceRecord, type AgentSpan, type AgentTrace, type AgentTraceDetails, type AgentTraceRecord, type AgentTraceSummary } from '../../domain/entities/agentTrace.js';
import type { IAgentTraceRepository } from '../../domain/ports/IAgentTraceRepository.js';

export class JsonlAgentTraceRepository implements IAgentTraceRepository {
  private queue = Promise.resolve();
  private readonly configuredPath?: string;

  constructor(configuredPath?: string) {
    this.configuredPath = configuredPath;
  }

  appendTrace(trace: AgentTrace) {
    return this.append(trace);
  }

  appendSpan(span: AgentSpan) {
    return this.append(span);
  }

  async list(limit = 100): Promise<AgentTraceSummary[]> {
    const records = await this.readRecords();
    const traces = new Map<string, AgentTraceSummary>();
    for (const record of records) {
      if (record.recordType === 'trace') {
        const previous = traces.get(record.traceId);
        traces.set(record.traceId, { ...record, createdAt: previous?.createdAt ?? record.createdAt, spanCount: previous?.spanCount ?? 0, lastSpanAt: previous?.lastSpanAt });
      } else {
        const trace = traces.get(record.traceId);
        if (trace) traces.set(record.traceId, { ...trace, spanCount: trace.spanCount + 1, lastSpanAt: record.endedAt });
      }
    }
    return [...traces.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, Math.min(Math.max(limit, 1), 500));
  }

  async get(traceId: string): Promise<AgentTraceDetails | null> {
    const records = (await this.readRecords()).filter((record) => record.traceId === traceId);
    const traceRecords = records.filter((record): record is AgentTrace => record.recordType === 'trace');
    const latest = traceRecords.at(-1);
    if (!latest) return null;
    return {
      trace: { ...latest, createdAt: traceRecords[0].createdAt },
      spans: records.filter((record): record is AgentSpan => record.recordType === 'span').sort((left, right) => left.startedAt.localeCompare(right.startedAt)),
    };
  }

  async exportJsonl(traceId: string | undefined, targetPath: string) {
    const records = (await this.readRecords()).filter((record) => !traceId || record.traceId === traceId);
    await fs.writeFile(targetPath, records.map((record) => JSON.stringify(record)).join('\n') + (records.length ? '\n' : ''), 'utf8');
    await fs.chmod(targetPath, 0o600).catch(() => undefined);
    return records.length;
  }

  private append(record: AgentTraceRecord) {
    assertValidTraceRecord(record);
    const operation = this.queue.then(async () => {
      await fs.mkdir(path.dirname(this.getPath()), { recursive: true });
      await fs.appendFile(this.getPath(), `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
      await fs.chmod(this.getPath(), 0o600).catch(() => undefined);
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  private async readRecords() {
    await this.queue;
    try {
      const lines = (await fs.readFile(this.getPath(), 'utf8')).split('\n').filter(Boolean);
      return lines.flatMap((line): AgentTraceRecord[] => {
        try {
          const record = JSON.parse(line) as AgentTraceRecord;
          assertValidTraceRecord(record);
          return [record];
        } catch {
          return [];
        }
      });
    } catch {
      return [];
    }
  }

  private getPath() {
    return this.configuredPath ?? path.join(app.getPath('userData'), 'observability', 'agent-traces.jsonl');
  }
}
