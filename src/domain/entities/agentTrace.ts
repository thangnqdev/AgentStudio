export type TraceStatus = 'running' | 'succeeded' | 'failed' | 'paused' | 'denied';

export type AgentTrace = {
  recordType: 'trace'; version: 1; traceId: string; taskId: string; status: TraceStatus; createdAt: string; updatedAt: string;
};

export type AgentSpan = {
  recordType: 'span'; version: 1; kind: 'model_call' | 'tool_call' | 'retrieval' | 'approval' | 'checkpoint' | 'evaluation';
  spanId: string; traceId: string; taskId: string; requestId?: string; parentSpanId?: string; step?: number;
  startedAt: string; endedAt: string; durationMs: number; status: TraceStatus;
  model?: string; finishReason?: string; usage?: { inputTokens: number; outputTokens: number; totalTokens: number; cachedInputTokens?: number };
  toolName?: string; risk?: 'read' | 'write' | 'execute' | 'network';
  outcome?: string; mode?: 'lexical' | 'hybrid' | 'unavailable'; resultCount?: number; toolSpanId?: string;
  decision?: string; checkpointStatus?: string; completedSteps?: number; evaluatorId?: string; evaluationVersion?: string;
  score?: number; provenanceId?: string;
};

export type AgentTraceSummary = AgentTrace & { spanCount: number; lastSpanAt?: string };
export type AgentTraceDetails = { trace: AgentTrace; spans: AgentSpan[] };
