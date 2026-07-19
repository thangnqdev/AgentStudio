import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../domain/entities/agent.js';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import { RunAgentSession } from './RunAgentSession.js';

describe('RunAgentSession collaboration completion', () => {
  it('keeps the lead turn open until background results are injected and synthesized', async () => {
    const requests: ChatMessage[][] = [];
    const provider = { requestAssistantMessage: vi.fn(async (_settings: unknown, messages: ChatMessage[]) => {
      requests.push(structuredClone(messages));
      return requests.length === 1
        ? { role: 'assistant' as const, content: 'Tôi sẽ đợi các agent phụ.', finishReason: 'stop' }
        : { role: 'assistant' as const, content: 'Báo cáo đã tổng hợp.', finishReason: 'stop' };
    }) };
    const emitDone = vi.fn();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let barrierCalls = 0;
    const collaboration = { waitForBackgroundResults: vi.fn(async () => {
      barrierCalls += 1;
      if (barrierCalls > 1) return [];
      await gate;
      return [{
        id: 'worker-result', sender: 'user' as const,
        content: '<agent-notification name="reviewer" status="completed">Found the root cause.</agent-notification>',
      }];
    }) };
    const session = createSession(provider);

    let finished = false;
    const running = session.execute(
      { requestId: 'lead', messages: [{ id: 'prompt', sender: 'user', content: 'Investigate and fix.' }] },
      { emitChunk: () => undefined, emitAction: () => undefined, emitDone, emitError: () => undefined },
      { baseUrl: 'https://provider.invalid', apiKey: '', model: 'model', permissionMode: 'workspace-write' },
      '/workspace', undefined, undefined, undefined, undefined, undefined, collaboration,
    ).then((result) => { finished = true; return result; });

    await vi.waitFor(() => expect(collaboration.waitForBackgroundResults).toHaveBeenCalledOnce());
    expect(finished).toBe(false);
    expect(emitDone).not.toHaveBeenCalled();
    release();

    await expect(running).resolves.toEqual({ status: 'completed', completedSteps: 0 });
    expect(provider.requestAssistantMessage).toHaveBeenCalledTimes(2);
    expect(emitDone).toHaveBeenCalledOnce();
    expect(requests[1]).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'system', content: expect.stringContaining('Found the root cause.') }),
      expect.objectContaining({ role: 'user', content: expect.stringContaining('reconcile their findings') }),
    ]));
  });
});

function createSession(provider: IAiProvider) {
  return new RunAgentSession(
    provider,
    { execute: async () => ({ ok: true, output: '' }) },
    { list: async () => [] },
    { format: async (messages) => messages.map((message) => ({ role: 'user' as const, content: message.content })) },
    { requestApproval: async () => true }, { record: async () => undefined },
    { newSpanId: () => 'span', startTrace: async () => undefined, updateTrace: async () => undefined, recordSpan: async () => 'span' },
  );
}
