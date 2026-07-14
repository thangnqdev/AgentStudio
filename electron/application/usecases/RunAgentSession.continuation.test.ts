import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../domain/entities/agent.js';
import { OUTPUT_CONTINUATION_PROMPT } from '../services/outputContinuation.js';
import { RunAgentSession } from './RunAgentSession.js';

describe('RunAgentSession output recovery', () => {
  it('continues a length-limited response without repeating the user request', async () => {
    const requests: ChatMessage[][] = [];
    let calls = 0;
    const provider = { requestAssistantMessage: async (_settings: unknown, messages: ChatMessage[]) => {
      requests.push(structuredClone(messages));
      calls += 1;
      return calls === 1
        ? { role: 'assistant' as const, content: 'part one', finishReason: 'length' }
        : { role: 'assistant' as const, content: 'part two', finishReason: 'stop' };
    } };
    let done = 0;
    const session = new RunAgentSession(
      provider,
      { execute: async () => ({ ok: true, output: '' }) },
      { list: async () => [] },
      { format: async (messages) => messages.map((message) => ({ role: 'user' as const, content: message.content })) },
      { requestApproval: async () => true },
      { record: async () => undefined },
      { newSpanId: () => 'span', startTrace: async () => undefined, updateTrace: async () => undefined, recordSpan: async () => 'span' },
    );
    const result = await session.execute(
      { requestId: 'request', messages: [{ id: 'user', sender: 'user', content: 'write a long answer' }] },
      { emitChunk: () => undefined, emitAction: () => undefined, emitDone: () => { done += 1; }, emitError: () => undefined },
      { baseUrl: 'https://provider.invalid', apiKey: '', model: 'model', permissionMode: 'workspace-write' },
      '/workspace',
    );
    expect(calls).toBe(2);
    expect(requests[1].at(-1)).toEqual({ role: 'user', content: OUTPUT_CONTINUATION_PROMPT });
    expect(result).toEqual({ status: 'completed', completedSteps: 0 });
    expect(done).toBe(1);
  });
});
