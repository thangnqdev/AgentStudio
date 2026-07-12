import type { AgentSpanInput, TraceStatus } from '../entities/agentTrace.js';

export interface IAgentTracer {
  newSpanId(): string;
  startTrace(traceId: string, taskId: string): Promise<void>;
  updateTrace(traceId: string, taskId: string, status: TraceStatus): Promise<void>;
  recordSpan(input: AgentSpanInput): Promise<string>;
}
