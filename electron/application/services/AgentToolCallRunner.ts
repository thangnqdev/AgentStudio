import type { ChatMessage, PermissionMode, ToolCall } from '../../domain/entities/agent.js';
import { evaluateToolPermission } from '../../domain/entities/permissionRule.js';
import type { AgentToolDefinition, ToolPolicyDecision } from '../../domain/entities/tool.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IToolApprovalGateway } from '../../domain/ports/IToolApprovalGateway.js';
import type { IToolAuditLogger } from '../../domain/ports/IToolAuditLogger.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import type { IToolPermissionPolicy } from '../../domain/ports/IToolPermissionPolicy.js';
import { summarizeToolArguments } from './toolActionPresentation.js';
import { parseAndValidateToolArguments } from './toolArgumentValidation.js';

export type ToolCallRunInput = {
  eventSink: IAgentEventSink;
  permissionMode: PermissionMode;
  requestId: string;
  step: number;
  toolCall: ToolCall;
  toolDefinition?: AgentToolDefinition;
  workspaceRoot: string;
  traceContext?: { traceId: string; taskId: string };
  signal?: AbortSignal;
};

export class AgentToolCallRunner {
  private readonly approvalGateway: IToolApprovalGateway;
  private readonly auditLogger: IToolAuditLogger;
  private readonly toolExecutor: IToolExecutor;
  private readonly tracer?: IAgentTracer;
  private readonly permissionPolicy?: IToolPermissionPolicy;

  constructor(
    toolExecutor: IToolExecutor,
    approvalGateway: IToolApprovalGateway,
    auditLogger: IToolAuditLogger,
    tracer?: IAgentTracer,
    permissionPolicy?: IToolPermissionPolicy,
  ) {
    this.toolExecutor = toolExecutor;
    this.approvalGateway = approvalGateway;
    this.auditLogger = auditLogger;
    this.tracer = tracer;
    this.permissionPolicy = permissionPolicy;
  }

  async run(input: ToolCallRunInput) {
    const toolName = input.toolCall.function?.name || '';
    const actionId = input.toolCall.id || `${input.requestId}-${toolName}-${input.step}`;
    const tool = input.toolDefinition;
    const risk = tool?.risk ?? 'execute';
    const toolSpanId = this.tracer?.newSpanId();
    const startedAt = new Date().toISOString();

    if (!tool) {
      const output = 'Unknown tool.';
      input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: '', risk, status: 'error', output });
      await this.recordAudit(actionId, 'error', input, risk, toolName);
      await this.recordToolSpan(input, toolSpanId, startedAt, toolName, risk, 'blocked', 'denied');
      return this.result(input.toolCall, toolName, '{}', { ok: false, output });
    }

    const parsed = parseAndValidateToolArguments(input.toolCall.function?.arguments || '{}', tool);
    const args = parsed.args;
    const argsText = JSON.stringify(args);
    const argsSummary = summarizeToolArguments(toolName, args);
    if (!parsed.ok) {
      input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: 'error', output: parsed.error });
      await this.recordAudit(actionId, 'error', input, risk, toolName);
      await this.recordToolSpan(input, toolSpanId, startedAt, toolName, risk, 'failed', 'failed');
      return this.result(input.toolCall, toolName, argsText, { ok: false, output: parsed.error });
    }

    let policy: ToolPolicyDecision;
    try {
      policy = this.permissionPolicy
        ? await this.permissionPolicy.evaluate({ tool, permissionMode: input.permissionMode, args, workspaceRoot: input.workspaceRoot })
        : evaluateToolPermission(tool, input.permissionMode, args, []);
    } catch {
      policy = { allowed: false, requiresApproval: false, reason: 'Tool execution is blocked because permission rules could not be loaded.' };
    }
    if (!policy.allowed) {
      const output = policy.reason || 'Tool execution is blocked by policy.';
      input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: 'error', output });
      await this.recordAudit(actionId, 'error', input, risk, toolName);
      await this.recordToolSpan(input, toolSpanId, startedAt, toolName, risk, 'blocked', 'denied');
      return this.result(input.toolCall, toolName, argsText, { ok: false, output });
    }

    if (policy.requiresApproval) {
      const approvalStartedAt = new Date().toISOString();
      input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: 'awaiting_approval' });
      const approved = await this.approvalGateway.requestApproval({ actionId, requestId: input.requestId, risk, toolName, summary: argsSummary, workspaceRoot: input.workspaceRoot });
      await this.recordApprovalSpan(input, toolSpanId, approvalStartedAt, toolName, approved ? 'approved' : 'denied');
      if (!approved) {
        const output = 'Tool execution was denied or approval timed out.';
        input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: 'denied', output });
        await this.recordAudit(actionId, 'denied', input, risk, toolName);
        await this.recordToolSpan(input, toolSpanId, startedAt, toolName, risk, 'denied', 'denied');
        return this.result(input.toolCall, toolName, argsText, { ok: false, output });
      }
      await this.recordAudit(actionId, 'approved', input, risk, toolName);
    }

    input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: 'running' });
    await this.recordAudit(actionId, 'started', input, risk, toolName);
    const toolResult = await this.toolExecutor.execute(toolName, args, input.workspaceRoot, input.permissionMode, input.signal);
    input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: toolResult.ok ? 'ok' : 'error', output: toolResult.output });
    await this.recordAudit(actionId, toolResult.ok ? 'succeeded' : 'error', input, risk, toolName);
    await this.recordToolSpan(input, toolSpanId, startedAt, toolName, risk, toolResult.ok ? 'succeeded' : 'failed', toolResult.ok ? 'succeeded' : 'failed');
    return this.result(input.toolCall, toolName, argsText, toolResult);
  }

  private result(toolCall: ToolCall, toolName: string, argsText: string, toolResult: { ok: boolean; output: string }) {
    return {
      stepContent: `\n[tool:${toolName}] ${argsText}\n${toolResult.ok ? '[ok]' : '[blocked/error]'}\n${toolResult.output}\n`,
      toolMessage: { role: 'tool' as const, tool_call_id: toolCall.id, content: JSON.stringify(toolResult) } satisfies ChatMessage,
    };
  }

  private async recordAudit(actionId: string, outcome: 'approved' | 'denied' | 'error' | 'started' | 'succeeded', input: ToolCallRunInput, risk: 'read' | 'write' | 'execute' | 'network', toolName: string) {
    await this.auditLogger.record({ actionId, outcome, requestId: input.requestId, risk, toolName, timestamp: new Date().toISOString(), workspaceRoot: input.workspaceRoot }).catch(() => undefined);
  }

  private async recordToolSpan(input: ToolCallRunInput, spanId: string | undefined, startedAt: string, toolName: string, risk: 'read' | 'write' | 'execute' | 'network', outcome: 'succeeded' | 'failed' | 'denied' | 'blocked', status: 'succeeded' | 'failed' | 'denied') {
    if (!this.tracer || !input.traceContext || !spanId) return;
    await this.tracer.recordSpan({ kind: 'tool_call', spanId, ...input.traceContext, requestId: input.requestId, step: input.step, startedAt, endedAt: new Date().toISOString(), status, toolName, risk, outcome }).catch(() => undefined);
  }

  private async recordApprovalSpan(input: ToolCallRunInput, toolSpanId: string | undefined, startedAt: string, toolName: string, decision: 'approved' | 'denied') {
    if (!this.tracer || !input.traceContext || !toolSpanId) return;
    await this.tracer.recordSpan({ kind: 'approval', ...input.traceContext, requestId: input.requestId, parentSpanId: toolSpanId, step: input.step, startedAt, endedAt: new Date().toISOString(), status: decision === 'approved' ? 'succeeded' : 'denied', toolName, toolSpanId, decision }).catch(() => undefined);
  }
}
