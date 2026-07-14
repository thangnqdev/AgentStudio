import { describe, expect, it } from 'vitest';
import { AGENT_TRACE_VERSION, assertValidTraceRecord, type AgentSpan } from './agentTrace.js';

describe('agent trace invariants', () => {
  const base: AgentSpan = {
    recordType: 'span', version: AGENT_TRACE_VERSION, kind: 'tool_call', spanId: 'span-1', traceId: 'trace-1', taskId: 'task-1', step: 2,
    startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T00:00:00.010Z', durationMs: 10, status: 'succeeded',
    toolName: 'read_file', risk: 'read', outcome: 'succeeded',
  };

  it('accepts allow-listed operational metadata', () => {
    expect(() => assertValidTraceRecord(base)).not.toThrow();
  });

  it('rejects content, secrets and invalid steps at runtime', () => {
    expect(() => assertValidTraceRecord({ ...base, prompt: 'sensitive source' } as AgentSpan)).toThrow('non-allow-listed');
    expect(() => assertValidTraceRecord({ ...base, apiKey: 'secret' } as AgentSpan)).toThrow('non-allow-listed');
    expect(() => assertValidTraceRecord({ ...base, step: -1 })).toThrow('span invariant');
  });

  it('accepts token counts but rejects prices and malformed usage', () => {
    const modelSpan: AgentSpan = {
      recordType: 'span', version: AGENT_TRACE_VERSION, kind: 'model_call', spanId: 'span-model', traceId: 'trace-1', taskId: 'task-1', step: 2,
      startedAt: '2026-01-01T00:00:00.000Z', endedAt: '2026-01-01T00:00:00.010Z', durationMs: 10, status: 'succeeded', model: 'custom-model',
      usage: { inputTokens: 12, outputTokens: 3, totalTokens: 15, cachedInputTokens: 4 },
    };
    expect(() => assertValidTraceRecord(modelSpan)).not.toThrow();
    expect(() => assertValidTraceRecord({ ...modelSpan, usage: { inputTokens: 12, outputTokens: 3, totalTokens: 2 } })).toThrow('valid model metadata');
    expect(() => assertValidTraceRecord({ ...modelSpan, usage: { ...modelSpan.usage!, usd: 1 } } as AgentSpan)).toThrow('valid model metadata');
  });
});
