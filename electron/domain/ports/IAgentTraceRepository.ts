import type { AgentSpan, AgentTrace, AgentTraceDetails, AgentTraceSummary } from '../entities/agentTrace.js';

export interface IAgentTraceRepository {
  appendTrace(trace: AgentTrace): Promise<void>;
  appendSpan(span: AgentSpan): Promise<void>;
  list(limit?: number): Promise<AgentTraceSummary[]>;
  get(traceId: string): Promise<AgentTraceDetails | null>;
  exportJsonl(traceId: string | undefined, targetPath: string): Promise<number>;
}
