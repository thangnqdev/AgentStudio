import { describe, expect, it } from 'vitest';
import {
  parseWorkerProcessBootstrap,
  parseWorkerProcessMessage,
  parseWorkerProcessToolResult,
} from './agentWorkerSessionProcess.js';

describe('agent worker session process protocol', () => {
  it('accepts a bounded bootstrap and rejects permission or unknown-field drift', () => {
    const value = bootstrap();
    expect(parseWorkerProcessBootstrap(value)).toMatchObject({ worker: { id: 'worker-1' }, settings: { model: 'model' } });
    expect(() => parseWorkerProcessBootstrap({ ...value, settings: { ...value.settings, permissionMode: 'read-only' } })).toThrow('inconsistent');
    expect(() => parseWorkerProcessBootstrap({ ...value, secret: 'leak' })).toThrow('unknown fields');
  });

  it('allows only model spans with an allow-listed shape', () => {
    const request = {
      kind: 'request', id: 'request-1', method: 'trace.record',
      payload: {
        kind: 'model_call', traceId: 'trace-1', taskId: 'worker-1', startedAt: '2026-07-16T00:00:00.000Z',
        endedAt: '2026-07-16T00:00:01.000Z', status: 'succeeded', model: 'model',
      },
    };
    expect(parseWorkerProcessMessage(request)).toMatchObject({ kind: 'request', method: 'trace.record' });
    expect(() => parseWorkerProcessMessage({ ...request, payload: { ...request.payload, apiKey: 'leak' } })).toThrow('unknown fields');
    expect(() => parseWorkerProcessMessage({ ...request, payload: { ...request.payload, kind: 'tool_call' } })).toThrow('only model spans');
  });

  it('allows only compaction lifecycle events across the child boundary', () => {
    expect(parseWorkerProcessMessage({
      kind: 'request', id: 'request-1', method: 'hook.dispatch', payload: { event: 'PreCompact' },
    })).toMatchObject({ method: 'hook.dispatch', payload: { event: 'PreCompact' } });
    expect(() => parseWorkerProcessMessage({
      kind: 'request', id: 'request-2', method: 'hook.dispatch', payload: { event: 'PreToolUse' },
    })).toThrow('hook event is invalid');
    expect(() => parseWorkerProcessMessage({
      kind: 'request', id: 'request-3', method: 'hook.dispatch', payload: { event: 'PostCompact', workspaceRoot: '/other' },
    })).toThrow('unknown fields');
  });

  it('narrows tool responses to a real tool message', () => {
    expect(parseWorkerProcessToolResult({
      stepContent: 'ok', toolMessage: { role: 'tool', tool_call_id: 'call-1', content: '{"ok":true}' },
      supplementalMessages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }] }],
    })).toMatchObject({ toolMessage: { role: 'tool', tool_call_id: 'call-1' }, supplementalMessages: [{ role: 'user' }] });
    expect(() => parseWorkerProcessToolResult({ stepContent: 'bad', toolMessage: { role: 'assistant', content: '' } })).toThrow('invalid');
    expect(() => parseWorkerProcessToolResult({
      stepContent: 'bad', toolMessage: { role: 'tool', tool_call_id: 'call-1', content: '{}' },
      supplementalMessages: [{ role: 'assistant', content: 'injected' }],
    })).toThrow('supplemental');
  });
});

function bootstrap() {
  return {
    worker: {
      id: 'worker-1', traceId: 'trace-1', parentScopeId: 'scope-1', description: 'test', prompt: 'work',
      permissionMode: 'workspace-write', workspaceRoot: '/workspace', depth: 1, background: true, status: 'running',
      createdAt: '2026-07-16T00:00:00.000Z', updatedAt: '2026-07-16T00:00:00.000Z', completedSteps: 0,
      messages: [{ id: 'prompt-1', sender: 'user', content: 'work' }], conversation: [],
    },
    settings: { baseUrl: 'https://example.test', apiKey: 'secret', model: 'model', permissionMode: 'workspace-write' },
    workspaceRoot: '/workspace',
  };
}
