import type { AgentTraceDetails } from '../../domain/entities/agentTrace.js';

export function successfulTrace(status: 'succeeded' | 'failed' = 'succeeded'): AgentTraceDetails {
  return { trace: { recordType: 'trace', version: 1, traceId: 'trace-private-task', taskId: 'task-1', status, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:01.000Z' }, spans: [tool('read_file', 0), tool('apply_patch', 1)] };
}
function tool(toolName: string, step: number) { return { recordType: 'span' as const, version: 1 as const, kind: 'tool_call' as const, spanId: `span-${step}`, traceId: 'trace-private-task', taskId: 'task-1', step, startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T00:00:00.010Z', durationMs: 10, status: 'succeeded' as const, toolName, risk: 'read' as const, outcome: 'succeeded' as const }; }
