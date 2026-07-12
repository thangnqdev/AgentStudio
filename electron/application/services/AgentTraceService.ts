import { AGENT_TRACE_VERSION, assertValidTraceRecord, type AgentSpan, type AgentSpanInput, type AgentTrace, type TraceStatus } from '../../domain/entities/agentTrace.js';
import type { IAgentTraceRepository } from '../../domain/ports/IAgentTraceRepository.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';

export class AgentTraceService implements IAgentTracer {
  private readonly repository: IAgentTraceRepository;
  private readonly traceCreatedAt = new Map<string, string>();

  constructor(repository: IAgentTraceRepository) {
    this.repository = repository;
  }

  newSpanId() {
    return crypto.randomUUID();
  }

  async startTrace(traceId: string, taskId: string) {
    const timestamp = new Date().toISOString();
    this.traceCreatedAt.set(traceId, timestamp);
    await this.writeTrace(traceId, taskId, 'running', timestamp, timestamp);
  }

  async updateTrace(traceId: string, taskId: string, status: TraceStatus) {
    const timestamp = new Date().toISOString();
    const existing = await this.repository.get(traceId);
    const createdAt = existing?.trace.createdAt ?? this.traceCreatedAt.get(traceId) ?? timestamp;
    await this.writeTrace(traceId, taskId, status, createdAt, timestamp);
  }

  async recordSpan(input: AgentSpanInput) {
    const spanId = input.spanId ?? this.newSpanId();
    const span = {
      ...input,
      recordType: 'span' as const,
      version: AGENT_TRACE_VERSION,
      spanId,
      durationMs: Math.max(0, Date.parse(input.endedAt) - Date.parse(input.startedAt)),
    } as AgentSpan;
    assertValidTraceRecord(span);
    await this.repository.appendSpan(span);
    return spanId;
  }

  list(limit?: number) {
    return this.repository.list(limit);
  }

  get(traceId: string) {
    return this.repository.get(traceId);
  }

  exportJsonl(traceId: string | undefined, targetPath: string) {
    return this.repository.exportJsonl(traceId, targetPath);
  }

  private async writeTrace(traceId: string, taskId: string, status: TraceStatus, createdAt: string, updatedAt: string) {
    const trace: AgentTrace = { recordType: 'trace', version: AGENT_TRACE_VERSION, traceId, taskId, status, createdAt, updatedAt };
    assertValidTraceRecord(trace);
    await this.repository.appendTrace(trace);
  }
}
