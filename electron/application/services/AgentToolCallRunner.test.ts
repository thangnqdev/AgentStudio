import { describe, expect, it, vi } from 'vitest';
import { AgentToolCallRunner } from './AgentToolCallRunner.js';

describe('AgentToolCallRunner', () => {
  it('waits for approval before executing a write tool', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: 'written' }));
    const actions: string[] = [];
    const runner = new AgentToolCallRunner(
      { execute },
      { requestApproval: async () => true },
      { record: async () => undefined },
    );

    const result = await runner.run({
      eventSink: { emitAction: (_requestId, action) => actions.push(action.status), emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'workspace-write',
      requestId: 'request-1',
      step: 0,
      toolCall: { id: 'action-1', function: { name: 'write_file', arguments: '{"path":"notes.md","content":"hello"}' } },
      workspaceRoot: '/workspace',
    });

    expect(actions).toEqual(['awaiting_approval', 'running', 'ok']);
    expect(execute).toHaveBeenCalledOnce();
    expect(result.stepContent).toContain('[tool:write_file]');
  });

  it('rejects mutation tools in read-only mode without executing them', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: 'written' }));
    const runner = new AgentToolCallRunner({ execute }, { requestApproval: async () => true }, { record: async () => undefined });

    const result = await runner.run({
      eventSink: { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'read-only',
      requestId: 'request-1',
      step: 0,
      toolCall: { id: 'action-1', function: { name: 'write_file', arguments: '{"path":"notes.md","content":"hello"}' } },
      workspaceRoot: '/workspace',
    });

    expect(execute).not.toHaveBeenCalled();
    expect(result.toolMessage.content).toContain('blocked in read-only mode');
  });
});
