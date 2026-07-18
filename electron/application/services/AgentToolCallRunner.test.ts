import { describe, expect, it, vi } from 'vitest';
import { AgentToolCallRunner } from './AgentToolCallRunner.js';
import { getLocalToolDefinition } from '../../infrastructure/tools/localToolDefinitions.js';
import type { AgentSpanInput } from '../../domain/entities/agentTrace.js';
import { WEB_FETCH_TOOL_DEFINITION } from '../../domain/entities/webFetch.js';

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

  it('dispatches audit-only permission request and denial lifecycle events', async () => {
    const events: string[] = [];
    const dispatch = vi.fn(async (input: { event: string }) => {
      events.push(input.event);
      return { matchedHookIds: [], contexts: [], auditLabels: [] };
    });
    const runner = new AgentToolCallRunner(
      { execute: vi.fn(async () => ({ ok: true, output: 'written' })) },
      { requestApproval: async () => false }, { record: async () => undefined }, undefined, undefined, { dispatch },
    );
    await runner.run({
      eventSink: { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'workspace-write', requestId: 'permission-hooks', step: 0, workspaceRoot: '/workspace',
      toolCall: { id: 'write', function: { name: 'write_file', arguments: '{"path":"notes.md","content":"hello"}' } },
      toolDefinition: getLocalToolDefinition('write_file'),
    });
    expect(events).toEqual(['PreToolUse', 'PermissionRequest', 'PermissionDenied']);
  });

  it('keeps multimodal supplements outside the serialized tool result', async () => {
    const supplementalMessages = [{ role: 'user' as const, content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }] }];
    const runner = new AgentToolCallRunner(
      { execute: async () => ({ ok: true, output: 'Image read.', supplementalMessages }) },
      { requestApproval: async () => true }, { record: async () => undefined },
    );
    const result = await runner.run({
      eventSink: { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'read-only', requestId: 'media', step: 0, workspaceRoot: '/workspace',
      toolCall: { id: 'image-call', function: { name: 'read_file', arguments: '{"path":"pixel.png"}' } },
      toolDefinition: getLocalToolDefinition('read_file'),
    });
    expect(result.supplementalMessages).toEqual(supplementalMessages);
    expect(result.toolMessage.content).toBe('{"ok":true,"output":"Image read."}');
    expect(result.toolMessage.content).not.toContain('base64');
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

  it('includes the normalized WebFetch hostname in approval requests', async () => {
    const requestApproval = vi.fn(async () => true);
    const runner = new AgentToolCallRunner(
      { execute: async () => ({ ok: true, output: 'fetched' }) },
      { requestApproval },
      { record: async () => undefined },
    );
    await runner.run({
      eventSink: { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'workspace-write', requestId: 'request-web', step: 0, workspaceRoot: '/workspace',
      toolCall: { id: 'web-action', function: { name: 'WebFetch', arguments: '{"url":"https://Docs.Example.com./guide","prompt":"summarize"}' } },
      toolDefinition: WEB_FETCH_TOOL_DEFINITION,
    });
    expect(requestApproval).toHaveBeenCalledWith(expect.objectContaining({ domain: 'docs.example.com' }));
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

  it('enforces a central deny rule in danger-full-access mode', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: 'executed' }));
    const runner = new AgentToolCallRunner(
      { execute }, { requestApproval: async () => true }, { record: async () => undefined }, undefined,
      { evaluate: async () => ({ allowed: false, requiresApproval: false, reason: 'Denied centrally.' }) },
    );
    const result = await runner.run({
      eventSink: { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'danger-full-access', requestId: 'request-deny', step: 0, workspaceRoot: '/workspace',
      toolCall: { id: 'action-deny', function: { name: 'run_command', arguments: '{"command":"npm test"}' } },
      toolDefinition: getLocalToolDefinition('run_command'),
    });
    expect(execute).not.toHaveBeenCalled();
    expect(result.toolMessage.content).toContain('Denied centrally');
  });

  it('uses a central allow rule without opening the approval gateway', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: 'written' }));
    const requestApproval = vi.fn(async () => true);
    const runner = new AgentToolCallRunner(
      { execute }, { requestApproval }, { record: async () => undefined }, undefined,
      { evaluate: async () => ({ allowed: true, requiresApproval: false }) },
    );
    await runner.run({
      eventSink: { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'workspace-write', requestId: 'request-allow', step: 0, workspaceRoot: '/workspace',
      toolCall: { id: 'action-allow', function: { name: 'write_file', arguments: '{"path":"notes.md","content":"hello"}' } },
      toolDefinition: getLocalToolDefinition('write_file'),
    });
    expect(requestApproval).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledOnce();
  });

  it('fails closed without exposing permission-source paths to the model', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: 'executed' }));
    const runner = new AgentToolCallRunner(
      { execute }, { requestApproval: async () => true }, { record: async () => undefined }, undefined,
      { evaluate: async () => { throw new Error('Invalid rules at /Users/private/rules.json'); } },
    );
    const result = await runner.run({
      eventSink: { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'workspace-write', requestId: 'request-policy-error', step: 0, workspaceRoot: '/workspace',
      toolCall: { id: 'action-policy-error', function: { name: 'read_file', arguments: '{"path":"notes.md"}' } },
      toolDefinition: getLocalToolDefinition('read_file'),
    });
    expect(execute).not.toHaveBeenCalled();
    expect(result.toolMessage.content).toContain('permission rules could not be loaded');
    expect(result.toolMessage.content).not.toContain('/Users/private');
  });

  it('forwards cancellation to the selected tool executor', async () => {
    const execute = vi.fn(async () => ({ ok: false, output: 'cancelled' }));
    const controller = new AbortController();
    const runner = new AgentToolCallRunner({ execute }, { requestApproval: async () => true }, { record: async () => undefined });
    await runner.run({
      eventSink: { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'danger-full-access', requestId: 'request-cancel', step: 0, workspaceRoot: '/workspace', signal: controller.signal,
      toolCall: { id: 'action-cancel', function: { name: 'run_command', arguments: '{"command":"npm test"}' } },
      toolDefinition: getLocalToolDefinition('run_command'),
    });
    expect(execute).toHaveBeenCalledWith('run_command', { command: 'npm test' }, '/workspace', 'danger-full-access', controller.signal);
  });

  it('lets declarative PreToolUse hooks restrict danger-full-access', async () => {
    const execute = vi.fn(async () => ({ ok: true, output: 'executed' }));
    const runner = new AgentToolCallRunner(
      { execute }, { requestApproval: async () => true }, { record: async () => undefined }, undefined, undefined,
      { dispatch: async () => ({ matchedHookIds: ['block-shell'], contexts: [], denyReason: 'Shell is blocked by workspace hooks.', auditLabels: [] }) },
    );
    const result = await runner.run({
      eventSink: { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'danger-full-access', requestId: 'request-hook-deny', step: 0, workspaceRoot: '/workspace',
      toolCall: { id: 'hook-deny', function: { name: 'run_command', arguments: '{"command":"npm test"}' } },
      toolDefinition: getLocalToolDefinition('run_command'),
    });
    expect(execute).not.toHaveBeenCalled();
    expect(result.toolMessage.content).toContain('Shell is blocked by workspace hooks');
  });

  it('adds bounded post-tool hook context to the model-visible tool result', async () => {
    const runner = new AgentToolCallRunner(
      { execute: async () => ({ ok: true, output: 'file contents' }) },
      { requestApproval: async () => true },
      { record: async () => undefined },
      undefined,
      undefined,
      { dispatch: async (input) => input.event === 'PostToolUse'
        ? { matchedHookIds: ['review'], contexts: ['Check generated types next.'], auditLabels: [] }
        : { matchedHookIds: [], contexts: [], auditLabels: [] } },
    );
    const result = await runner.run({
      eventSink: { emitAction: () => undefined, emitChunk: () => undefined, emitDone: () => undefined, emitError: () => undefined },
      permissionMode: 'read-only', requestId: 'request-hook-context', step: 0, workspaceRoot: '/workspace',
      toolCall: { id: 'hook-context', function: { name: 'read_file', arguments: '{"path":"notes.md"}' } },
      toolDefinition: getLocalToolDefinition('read_file'),
    });
    expect(result.toolMessage.content).toContain('Check generated types next.');
    expect(result.toolMessage.content).toContain('trust=\\"workspace-declarative\\"');
  });
});
