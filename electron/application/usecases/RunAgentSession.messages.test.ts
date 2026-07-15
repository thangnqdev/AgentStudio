import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../domain/entities/agent.js';
import { RunAgentSession } from './RunAgentSession.js';

describe('RunAgentSession queued messages', () => {
  it('injects queued parent messages at the next tool-round boundary', async () => {
    const requests: ChatMessage[][] = [];
    let modelCalls = 0;
    const provider = { requestAssistantMessage: async (_settings: unknown, messages: ChatMessage[]) => {
      requests.push(structuredClone(messages));
      modelCalls += 1;
      return modelCalls === 1
        ? { role: 'assistant' as const, content: '', tool_calls: [{ id: 'call-1', function: { name: 'read_file', arguments: '{}' } }] }
        : { role: 'assistant' as const, content: 'updated', finishReason: 'stop' };
    } };
    let drained = false;
    const session = new RunAgentSession(
      provider,
      { execute: async () => ({ ok: true, output: 'file' }) },
      { list: async () => [{ name: 'read_file', description: '', risk: 'read' as const, parameters: { type: 'object', properties: {} } }] },
      { format: async (messages) => messages.map((message) => ({ role: 'user' as const, content: message.content })) },
      { requestApproval: async () => true }, { record: async () => undefined },
      { newSpanId: () => 'span', startTrace: async () => undefined, updateTrace: async () => undefined, recordSpan: async () => 'span' },
    );
    await session.execute(
      { requestId: 'worker', messages: [{ id: 'prompt', sender: 'user', content: 'Initial task' }] },
      { emitChunk: () => undefined, emitAction: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      { baseUrl: 'https://provider.invalid', apiKey: '', model: 'model', permissionMode: 'read-only' }, '/workspace', undefined, undefined, undefined,
      {
        id: 'worker', traceId: 'trace', workspaceRoot: '/workspace', completedSteps: 0,
        messages: [{ id: 'prompt', sender: 'user', content: 'Initial task' }], conversation: [],
        onCheckpoint: async () => undefined,
        drainMessages: async () => drained ? [] : (drained = true, [{ id: 'redirect', sender: 'user', content: 'Focus on timeout handling.' }]),
      },
    );
    expect(requests).toHaveLength(2);
    expect(requests[1].at(-1)).toEqual({ role: 'user', content: 'Focus on timeout handling.' });
  });

  it('refreshes the tool schema catalog before every model request', async () => {
    const visibleToolNames: string[][] = [];
    let modelCalls = 0;
    let catalogCalls = 0;
    const provider = {
      requestAssistantMessage: async (_settings: unknown, _messages: ChatMessage[], tools: Array<{ name: string }>) => {
        visibleToolNames.push(tools.map((tool) => tool.name));
        modelCalls += 1;
        return modelCalls === 1
          ? { role: 'assistant' as const, content: '', tool_calls: [{ id: 'search', function: { name: 'ToolSearch', arguments: '{}' } }] }
          : { role: 'assistant' as const, content: 'done', finishReason: 'stop' };
      },
    };
    const session = new RunAgentSession(
      provider,
      { execute: async () => ({ ok: true, output: 'loaded' }) },
      { list: async () => {
        catalogCalls += 1;
        return catalogCalls === 1
          ? [toolDefinition('ToolSearch')]
          : [toolDefinition('ToolSearch'), toolDefinition('SendMessage')];
      } },
      { format: async (messages) => messages.map((message) => ({ role: 'user' as const, content: message.content })) },
      { requestApproval: async () => true }, { record: async () => undefined },
      { newSpanId: () => 'span', startTrace: async () => undefined, updateTrace: async () => undefined, recordSpan: async () => 'span' },
    );
    await session.execute(
      { requestId: 'refresh', messages: [{ id: 'prompt', sender: 'user', content: 'Coordinate.' }] },
      { emitChunk: () => undefined, emitAction: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      { baseUrl: 'https://provider.invalid', apiKey: '', model: 'model', permissionMode: 'read-only' },
      '/workspace',
    );
    expect(visibleToolNames).toEqual([['ToolSearch'], ['ToolSearch', 'SendMessage']]);
  });
});

function toolDefinition(name: string) {
  return { name, description: '', risk: 'read' as const, parameters: { type: 'object', properties: {} } };
}
