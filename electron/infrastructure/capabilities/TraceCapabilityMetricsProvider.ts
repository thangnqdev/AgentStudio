import type { AgentSpan } from '../../domain/entities/agentTrace.js';
import type { CapabilityFailureType, CapabilityMetrics } from '../../domain/entities/capability.js';
import type { IAgentTraceRepository } from '../../domain/ports/IAgentTraceRepository.js';
import type { ICapabilityMetricsProvider } from '../../domain/ports/ICapabilityMetricsProvider.js';

export class TraceCapabilityMetricsProvider implements ICapabilityMetricsProvider {
  private readonly traces: IAgentTraceRepository;

  constructor(traces: IAgentTraceRepository) {
    this.traces = traces;
  }
  async getMetrics(capabilityIds: string[]) {
    const wanted = new Set(capabilityIds); const samples = new Map<string, AgentSpan[]>();
    for (const summary of await this.traces.list(200)) {
      const details = await this.traces.get(summary.traceId);
      for (const span of details?.spans ?? []) {
        const id = span.kind === 'tool_call' ? `tool:${span.toolName}` : span.kind === 'retrieval' ? 'knowledge:retrieval' : '';
        if (id && wanted.has(id)) samples.set(id, [...samples.get(id) ?? [], span]);
      }
    }
    return new Map(capabilityIds.map((id) => [id, aggregate(samples.get(id) ?? [])]));
  }
}

function aggregate(spans: AgentSpan[]): CapabilityMetrics {
  if (!spans.length) return { sampleCount: 0, successRate: null, meanLatencyMs: null, p95LatencyMs: null, failureTypes: {} };
  const latencies = spans.map((span) => span.durationMs).sort((a, b) => a - b);
  const successes = spans.filter((span) => span.status === 'succeeded').length;
  const failureTypes: Partial<Record<CapabilityFailureType, number>> = {};
  for (const span of spans.filter((item) => item.status !== 'succeeded')) { const type = failureType(span); failureTypes[type] = (failureTypes[type] ?? 0) + 1; }
  return { sampleCount: spans.length, successRate: successes / spans.length, meanLatencyMs: latencies.reduce((sum, value) => sum + value, 0) / latencies.length, p95LatencyMs: latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)], failureTypes };
}

function failureType(span: AgentSpan): CapabilityFailureType {
  if (span.kind === 'tool_call' && span.outcome === 'blocked') return 'blocked';
  if (span.kind === 'tool_call' && span.outcome === 'denied') return 'denied';
  return span.status === 'failed' ? 'execution_error' : 'unknown';
}
