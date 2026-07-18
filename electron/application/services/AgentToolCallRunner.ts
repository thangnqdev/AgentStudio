import type { ChatMessage, PermissionMode, ToolCall, ToolResult } from '../../domain/entities/agent.js';
import { evaluateToolPermission } from '../../domain/entities/permissionRule.js';
import type { AgentToolDefinition, ToolPolicyDecision } from '../../domain/entities/tool.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IToolApprovalGateway } from '../../domain/ports/IToolApprovalGateway.js';
import type { IToolAuditLogger } from '../../domain/ports/IToolAuditLogger.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import type { IToolPermissionPolicy } from '../../domain/ports/IToolPermissionPolicy.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';
import { summarizeToolArguments } from './toolActionPresentation.js';
import { parseAndValidateToolArguments } from './toolArgumentValidation.js';
import { formatLifecycleHookContext } from './LifecycleHookDispatcher.js';

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
  private readonly hooks?: ILifecycleHookDispatcher;

  constructor(
    toolExecutor: IToolExecutor,
    approvalGateway: IToolApprovalGateway,
    auditLogger: IToolAuditLogger,
    tracer?: IAgentTracer,
    permissionPolicy?: IToolPermissionPolicy,
    hooks?: ILifecycleHookDispatcher,
  ) {
    this.toolExecutor = toolExecutor;
    this.approvalGateway = approvalGateway;
    this.auditLogger = auditLogger;
    this.tracer = tracer;
    this.permissionPolicy = permissionPolicy;
    this.hooks = hooks;
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
    let preToolHook: Awaited<ReturnType<ILifecycleHookDispatcher['dispatch']>> | undefined;
    try {
      preToolHook = await this.hooks?.dispatch({
        event: 'PreToolUse', workspaceRoot: input.workspaceRoot, matchValue: toolName,
        requestId: input.requestId, toolName,
      });
      policy = this.permissionPolicy
        ? await this.permissionPolicy.evaluate({ tool, permissionMode: input.permissionMode, args, workspaceRoot: input.workspaceRoot })
        : evaluateToolPermission(tool, input.permissionMode, args, []);
    } catch {
      policy = { allowed: false, requiresApproval: false, reason: 'Tool execution is blocked because permission rules could not be loaded.' };
    }
    if (!policy.allowed) {
      const output = policy.reason || 'Tool execution is blocked by policy.';
      await this.dispatchPermissionHook('PermissionDenied', input, toolName);
      input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: 'error', output });
      await this.recordAudit(actionId, 'error', input, risk, toolName);
      await this.recordToolSpan(input, toolSpanId, startedAt, toolName, risk, 'blocked', 'denied');
      return this.result(input.toolCall, toolName, argsText, { ok: false, output });
    }
    if (preToolHook?.denyReason) {
      const output = `Tool denied by declarative lifecycle hook: ${preToolHook.denyReason}`;
      await this.dispatchPermissionHook('PermissionDenied', input, toolName);
      input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: 'error', output });
      await this.recordAudit(actionId, 'denied', input, risk, toolName);
      await this.recordToolSpan(input, toolSpanId, startedAt, toolName, risk, 'blocked', 'denied');
      return this.result(input.toolCall, toolName, argsText, { ok: false, output });
    }

    if (policy.requiresApproval || preToolHook?.approvalReason) {
      await this.dispatchPermissionHook('PermissionRequest', input, toolName);
      const approvalStartedAt = new Date().toISOString();
      const approvalSummary = preToolHook?.approvalReason ? `${argsSummary}\nHook requires approval: ${preToolHook.approvalReason}` : argsSummary;
      input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: approvalSummary, risk, status: 'awaiting_approval' });
      const domain = readApprovalDomain(toolName, args);
      const approved = await this.approvalGateway.requestApproval({
        actionId, requestId: input.requestId, risk, toolName, summary: approvalSummary,
        workspaceRoot: input.workspaceRoot, ...(domain ? { domain } : {}),
      });
      await this.recordApprovalSpan(input, toolSpanId, approvalStartedAt, toolName, approved ? 'approved' : 'denied');
      if (!approved) {
        const output = 'Tool execution was denied or approval timed out.';
        await this.dispatchPermissionHook('PermissionDenied', input, toolName);
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
    const finalResult = await this.applyPostToolHooks(input, toolName, toolResult);
    input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: finalResult.ok ? 'ok' : 'error', output: finalResult.output });
    await this.recordAudit(actionId, finalResult.ok ? 'succeeded' : 'error', input, risk, toolName);
    await this.recordToolSpan(input, toolSpanId, startedAt, toolName, risk, finalResult.ok ? 'succeeded' : 'failed', finalResult.ok ? 'succeeded' : 'failed');
    return this.result(input.toolCall, toolName, argsText, finalResult);
  }

  private async applyPostToolHooks(input: ToolCallRunInput, toolName: string, toolResult: ToolResult): Promise<ToolResult> {
    if (!this.hooks) return toolResult;
    const event = toolResult.ok ? 'PostToolUse' as const : 'PostToolUseFailure' as const;
    try {
      const result = await this.hooks.dispatch({
        event, workspaceRoot: input.workspaceRoot, matchValue: toolName,
        requestId: input.requestId, toolName,
      });
      const context = formatLifecycleHookContext(event, result.contexts);
      return context ? { ...toolResult, output: `${toolResult.output}\n\n${context}` } : toolResult;
    } catch {
      return { ...toolResult, output: `${toolResult.output}\n\n[Post-tool lifecycle hooks could not be evaluated.]` };
    }
  }

  private result(toolCall: ToolCall, toolName: string, argsText: string, toolResult: ToolResult) {
    const serializableResult = { ok: toolResult.ok, output: toolResult.output };
    return {
      stepContent: `\n[tool:${toolName}] ${argsText}\n${toolResult.ok ? '[ok]' : '[blocked/error]'}\n${toolResult.output}\n`,
      toolMessage: { role: 'tool' as const, tool_call_id: toolCall.id, content: JSON.stringify(serializableResult) } satisfies ChatMessage,
      ...(toolResult.supplementalMessages?.length ? { supplementalMessages: toolResult.supplementalMessages } : {}),
    };
  }

  private async dispatchPermissionHook(event: 'PermissionRequest' | 'PermissionDenied', input: ToolCallRunInput, toolName: string) {
    await this.hooks?.dispatch({
      event, workspaceRoot: input.workspaceRoot, matchValue: toolName,
      requestId: input.requestId, toolName, taskId: input.traceContext?.taskId,
    }).catch(() => undefined);
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

function readApprovalDomain(toolName: string, args: Record<string, unknown>) {
  if (toolName !== 'WebFetch' || typeof args.url !== 'string') return undefined;
  try { return new URL(args.url).hostname.toLowerCase().replace(/\.$/, ''); } catch { return undefined; }
}
