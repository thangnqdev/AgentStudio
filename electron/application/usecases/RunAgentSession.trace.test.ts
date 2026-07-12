import { describe, expect, it } from 'vitest';
import type { AgentSpanInput } from '../../domain/entities/agentTrace.js';
import { RunAgentSession } from './RunAgentSession.js';

describe('RunAgentSession tracing', () => {
  it('records a model call with task and step linkage without conversation content', async () => {
    const spans: AgentSpanInput[] = [];
    const tracer = { newSpanId: () => 'span', startTrace: async () => undefined, updateTrace: async () => undefined, recordSpan: async (span: AgentSpanInput) => { spans.push(span); return 'span'; } };
    const session = new RunAgentSession(
      { requestAssistantMessage: async () => ({ role: 'assistant' as const, content: 'private model response', finishReason: 'stop' }) },
      { execute: async () => ({ ok: true, output: '' }) }, { list: async () => [] },
      { format: async () => [{ role: 'user' as const, content: 'private prompt' }] },
      { requestApproval: async () => true }, { record: async () => undefined }, tracer,
    );
    await session.execute(
      { requestId: 'request-1', messages: [{ id: 'user-1', sender: 'user', content: 'private prompt' }] },
      { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      { baseUrl: 'https://provider.invalid', apiKey: 'secret-key', model: 'model-1', permissionMode: 'workspace-write' }, '/workspace', '', '', undefined,
      { id: 'task-1', traceId: 'trace-1', workspaceRoot: '/workspace', completedSteps: 0, messages: [{ id: 'user-1', sender: 'user', content: 'private prompt' }], conversation: [], onCheckpoint: async () => undefined },
    );
    expect(spans[0]).toMatchObject({ kind: 'model_call', traceId: 'trace-1', taskId: 'task-1', requestId: 'request-1', step: 0, model: 'model-1', status: 'succeeded' });
    expect(JSON.stringify(spans)).not.toContain('private prompt');
    expect(JSON.stringify(spans)).not.toContain('private model response');
    expect(JSON.stringify(spans)).not.toContain('secret-key');
  });
});
