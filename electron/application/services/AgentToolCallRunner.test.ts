import { describe, expect, it, vi } from 'vitest';
import { AgentToolCallRunner } from './AgentToolCallRunner.js';
import { getLocalToolDefinition } from '../../infrastructure/tools/localToolDefinitions.js';
import type { AgentSpanInput } from '../../domain/entities/agentTrace.js';

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
      toolDefinition: getLocalToolDefinition('write_file'),
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
      toolDefinition: getLocalToolDefinition('write_file'),
      workspaceRoot: '/workspace',
    });

    expect(execute).not.toHaveBeenCalled();
    expect(result.toolMessage.content).toContain('blocked in read-only mode');
  });

  it('applies the same policy to a dynamically discovered MCP tool', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: 'external result' }));
    const requestApproval = vi.fn(async () => true);
    const runner = new AgentToolCallRunner({ execute }, { requestApproval }, { record: async () => undefined });
    await runner.run({
      eventSink: { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'workspace-write', requestId: 'request-2', step: 0, workspaceRoot: '/workspace',
      toolCall: { id: 'mcp-action', function: { name: 'mcp_server_tool', arguments: '{}' } },
      toolDefinition: {
        name: 'mcp_server_tool', description: 'external', risk: 'execute', parameters: { type: 'object' },
        source: { kind: 'mcp', serverId: 'server', remoteToolName: 'tool' },
      },
    });
    expect(requestApproval).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
  });

  it('rejects malformed tool arguments before asking for approval or executing', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: 'written' }));
    const requestApproval = vi.fn(async () => true);
    const runner = new AgentToolCallRunner({ execute }, { requestApproval }, { record: async () => undefined });
    const result = await runner.run({
      eventSink: { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'workspace-write', requestId: 'request-invalid', step: 0, workspaceRoot: '/workspace',
      toolCall: { id: 'invalid-action', function: { name: 'write_file', arguments: '{"path":"notes.md"}' } },
      toolDefinition: getLocalToolDefinition('write_file'),
    });
    expect(requestApproval).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.parse(result.toolMessage.content as string).output).toContain('required property "content" is missing');
  });

  it('links sanitized tool and approval spans to the task step', async () => {
    const spans: AgentSpanInput[] = [];
    const tracer = {
      newSpanId: () => 'tool-span', startTrace: async () => undefined, updateTrace: async () => undefined,
      recordSpan: async (span: AgentSpanInput) => { spans.push(span); return span.spanId ?? 'generated-span'; },
    };
    const runner = new AgentToolCallRunner({ execute: async () => ({ ok: true, output: 'sensitive output' }) }, { requestApproval: async () => true }, { record: async () => undefined }, tracer);
    await runner.run({
      eventSink: { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'workspace-write', requestId: 'request-3', step: 7, workspaceRoot: '/workspace', traceContext: { traceId: 'trace-1', taskId: 'task-1' },
      toolCall: { id: 'action-3', function: { name: 'write_file', arguments: '{"path":"secret.txt","content":"sensitive input"}' } },
      toolDefinition: getLocalToolDefinition('write_file'),
    });
    expect(spans.find((span) => span.kind === 'tool_call')).toMatchObject({ traceId: 'trace-1', taskId: 'task-1', step: 7, spanId: 'tool-span' });
    expect(spans.find((span) => span.kind === 'approval')).toMatchObject({ parentSpanId: 'tool-span', toolSpanId: 'tool-span', decision: 'approved' });
    expect(JSON.stringify(spans)).not.toContain('sensitive input');
    expect(JSON.stringify(spans)).not.toContain('sensitive output');
  });
});
