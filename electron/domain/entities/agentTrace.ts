export const AGENT_TRACE_VERSION = 1;

export type TraceStatus = 'running' | 'succeeded' | 'failed' | 'paused' | 'denied';
export type SpanKind = 'model_call' | 'tool_call' | 'retrieval' | 'approval' | 'checkpoint' | 'evaluation';

export type AgentTrace = {
  recordType: 'trace';
  version: typeof AGENT_TRACE_VERSION;
  traceId: string;
  taskId: string;
  status: TraceStatus;
  createdAt: string;
  updatedAt: string;
};

export type Span = {
  recordType: 'span';
  version: typeof AGENT_TRACE_VERSION;
  kind: SpanKind;
  spanId: string;
  traceId: string;
  taskId: string;
  requestId?: string;
  parentSpanId?: string;
  step?: number;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: TraceStatus;
};

export type ModelUsageTrace = { inputTokens: number; outputTokens: number; totalTokens: number; cachedInputTokens?: number };
export type ModelCallTrace = Span & { kind: 'model_call'; model: string; finishReason?: string; usage?: ModelUsageTrace };
export type ToolCallTrace = Span & { kind: 'tool_call'; toolName: string; risk: 'read' | 'write' | 'execute' | 'network'; outcome: 'succeeded' | 'failed' | 'denied' | 'blocked' };
export type RetrievalTrace = Span & { kind: 'retrieval'; mode: 'lexical' | 'hybrid' | 'unavailable'; resultCount: number };
export type ApprovalTrace = Span & { kind: 'approval'; toolName: string; toolSpanId: string; decision: 'approved' | 'denied' | 'timeout' };
export type CheckpointTrace = Span & { kind: 'checkpoint'; checkpointStatus: 'running' | 'paused' | 'completed' | 'failed'; completedSteps: number };
export type EvaluationTrace = Span & { kind: 'evaluation'; evaluatorId: string; evaluationVersion: string; score: number; provenanceId: string };
export type AgentSpan = ModelCallTrace | ToolCallTrace | RetrievalTrace | ApprovalTrace | CheckpointTrace | EvaluationTrace;
export type AgentTraceRecord = AgentTrace | AgentSpan;

export type AgentTraceDetails = { trace: AgentTrace; spans: AgentSpan[] };
export type AgentTraceSummary = AgentTrace & { spanCount: number; lastSpanAt?: string };

type SpanInputCommon = { traceId: string; taskId: string; requestId?: string; parentSpanId?: string; spanId?: string; step?: number; startedAt: string; endedAt: string; status: TraceStatus };
export type AgentSpanInput = SpanInputCommon & (
  | { kind: 'model_call'; model: string; finishReason?: string; usage?: ModelUsageTrace }
  | { kind: 'tool_call'; toolName: string; risk: ToolCallTrace['risk']; outcome: ToolCallTrace['outcome'] }
  | { kind: 'retrieval'; mode: RetrievalTrace['mode']; resultCount: number }
  | { kind: 'approval'; toolName: string; toolSpanId: string; decision: ApprovalTrace['decision'] }
  | { kind: 'checkpoint'; checkpointStatus: CheckpointTrace['checkpointStatus']; completedSteps: number }
  | { kind: 'evaluation'; evaluatorId: string; evaluationVersion: string; score: number; provenanceId: string }
);

export function assertValidTraceRecord(record: AgentTraceRecord) {
  const baseTraceKeys = ['recordType', 'version', 'traceId', 'taskId', 'status', 'createdAt', 'updatedAt'];
  const baseSpanKeys = ['recordType', 'version', 'kind', 'spanId', 'traceId', 'taskId', 'requestId', 'parentSpanId', 'step', 'startedAt', 'endedAt', 'durationMs', 'status'];
  const kindKeys: Record<SpanKind, string[]> = {
    model_call: ['model', 'finishReason', 'usage'],
    tool_call: ['toolName', 'risk', 'outcome'],
    retrieval: ['mode', 'resultCount'],
    approval: ['toolName', 'toolSpanId', 'decision'],
    checkpoint: ['checkpointStatus', 'completedSteps'],
    evaluation: ['evaluatorId', 'evaluationVersion', 'score', 'provenanceId'],
  };
  if (!['running', 'succeeded', 'failed', 'paused', 'denied'].includes(record.status)) throw new Error('Invalid agent trace status.');
  if (!record.traceId || !record.taskId || record.version !== AGENT_TRACE_VERSION) throw new Error('Invalid agent trace identity.');
  if (record.recordType === 'trace') {
    assertOnlyKeys(record, baseTraceKeys);
    if (!isIsoDate(record.createdAt) || !isIsoDate(record.updatedAt)) throw new Error('Invalid agent trace timestamp.');
  } else {
    if (!kindKeys[record.kind]) throw new Error('Invalid agent span kind.');
    assertOnlyKeys(record, [...baseSpanKeys, ...kindKeys[record.kind]]);
    if (!isIsoDate(record.startedAt) || !isIsoDate(record.endedAt)) throw new Error('Invalid agent trace timestamp.');
    if (!record.spanId || record.durationMs < 0 || (record.step !== undefined && (!Number.isInteger(record.step) || record.step < 0))) throw new Error('Invalid agent span invariant.');
    assertKindInvariant(record);
  }
}

function assertKindInvariant(span: AgentSpan) {
  if (span.kind === 'model_call' && (!span.model || (span.usage && !isValidModelUsage(span.usage)))) throw new Error('Model trace requires valid model metadata.');
  if (span.kind === 'tool_call' && (!span.toolName || !['read', 'write', 'execute', 'network'].includes(span.risk) || !['succeeded', 'failed', 'denied', 'blocked'].includes(span.outcome))) throw new Error('Tool trace invariant failed.');
  if (span.kind === 'retrieval' && (!['lexical', 'hybrid', 'unavailable'].includes(span.mode) || !Number.isInteger(span.resultCount) || span.resultCount < 0)) throw new Error('Retrieval trace invariant failed.');
  if (span.kind === 'approval' && (!span.toolName || !span.toolSpanId || !['approved', 'denied', 'timeout'].includes(span.decision))) throw new Error('Approval trace invariant failed.');
  if (span.kind === 'checkpoint' && (!['running', 'paused', 'completed', 'failed'].includes(span.checkpointStatus) || !Number.isInteger(span.completedSteps) || span.completedSteps < 0)) throw new Error('Checkpoint trace invariant failed.');
  if (span.kind === 'evaluation' && (!span.evaluatorId || !span.evaluationVersion || !span.provenanceId || !Number.isFinite(span.score))) throw new Error('Evaluation trace invariant failed.');
}

function isValidModelUsage(usage: ModelUsageTrace) {
  const values = [usage.inputTokens, usage.outputTokens, usage.totalTokens, usage.cachedInputTokens].filter((value) => value !== undefined);
  return Object.keys(usage).every((key) => ['inputTokens', 'outputTokens', 'totalTokens', 'cachedInputTokens'].includes(key))
    && values.every((value) => Number.isSafeInteger(value) && value >= 0)
    && usage.totalTokens >= usage.inputTokens + usage.outputTokens
    && (usage.cachedInputTokens === undefined || usage.cachedInputTokens <= usage.inputTokens);
}

function assertOnlyKeys(value: object, allowedKeys: string[]) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error('Trace record contains non-allow-listed data.');
}

function isIsoDate(value: string) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
