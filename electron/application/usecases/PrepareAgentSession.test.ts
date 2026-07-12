import { describe, expect, it } from 'vitest';
import type { AgentSpanInput } from '../../domain/entities/agentTrace.js';
import type { AgentTaskRecord } from '../../domain/entities/agentTask.js';
import { PrepareAgentSession } from './PrepareAgentSession.js';

describe('PrepareAgentSession', () => {
  it('records retrieval metadata without query or retrieved content', async () => {
    const spans: AgentSpanInput[] = [];
    let observedTuning: unknown;
    const task: AgentTaskRecord = {
      id: 'task-1', traceId: 'trace-1', title: 'Task', workspaceRoot: '/workspace', status: 'running',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', completedSteps: 0,
      messages: [{ id: 'user-1', sender: 'user', content: 'private database question' }], conversation: [], knowledgeContext: '',
    };
    const useCase = new PrepareAgentSession(
      { create: async () => task, resume: async () => task, checkpoint: async () => undefined },
      { buildContextDetails: async (_root, _question, _context, tuning) => { observedTuning = tuning; return { context: 'private retrieved content', mode: 'hybrid' as const, resultCount: 4 }; } },
      { buildPromptContext: async () => 'skill context' },
      { newSpanId: () => 'span', startTrace: async () => undefined, updateTrace: async () => undefined, recordSpan: async (span) => { spans.push(span); return 'span'; } },
      { load: async () => ({ active: { retrievalTopK: 9, lexicalWeight: 0.7, semanticWeight: 0.3, skillRankingWeight: 0.6 } }) as never },
    );
    const result = await useCase.execute({ payload: { messages: task.messages }, taskId: '', requestId: 'request-1', workspaceRoot: '/workspace' });
    expect(result.task.knowledgeContext).toBe('private retrieved content');
    expect(observedTuning).toMatchObject({ retrievalTopK: 9, lexicalWeight: 0.7, semanticWeight: 0.3 });
    expect(spans[0]).toMatchObject({ kind: 'retrieval', traceId: 'trace-1', taskId: 'task-1', mode: 'hybrid', resultCount: 4 });
    expect(JSON.stringify(spans)).not.toContain('private database question');
    expect(JSON.stringify(spans)).not.toContain('private retrieved content');
  });
});
