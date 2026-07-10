import type { ChatMessage, PermissionMode, ToolCall } from '../../domain/entities/agent.js';
import { evaluateToolPolicy, getAgentToolDefinition } from '../../domain/entities/tool.js';
import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IToolApprovalGateway } from '../../domain/ports/IToolApprovalGateway.js';
import type { IToolAuditLogger } from '../../domain/ports/IToolAuditLogger.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import { summarizeToolArguments } from './toolActionPresentation.js';

type ToolCallRunInput = {
  eventSink: IAgentEventSink;
  permissionMode: PermissionMode;
  requestId: string;
  step: number;
  toolCall: ToolCall;
  workspaceRoot: string;
};

export class AgentToolCallRunner {
  private readonly approvalGateway: IToolApprovalGateway;
  private readonly auditLogger: IToolAuditLogger;
  private readonly toolExecutor: IToolExecutor;

  constructor(
    toolExecutor: IToolExecutor,
    approvalGateway: IToolApprovalGateway,
    auditLogger: IToolAuditLogger,
  ) {
    this.toolExecutor = toolExecutor;
    this.approvalGateway = approvalGateway;
    this.auditLogger = auditLogger;
  }

  async run(input: ToolCallRunInput) {
    const toolName = input.toolCall.function?.name || '';
    const args = parseToolArguments(input.toolCall.function?.arguments || '{}');
    const actionId = input.toolCall.id || `${input.requestId}-${toolName}-${input.step}`;
    const argsText = JSON.stringify(args);
    const tool = getAgentToolDefinition(toolName);
    const risk = tool?.risk ?? 'execute';
    const argsSummary = summarizeToolArguments(toolName, args);
    const policy = evaluateToolPolicy(tool, input.permissionMode);

    if (!policy.allowed) {
      const output = policy.reason || 'Tool execution is blocked by policy.';
      input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: 'error', output });
      await this.recordAudit(actionId, 'error', input, risk, toolName);
      return this.result(input.toolCall, toolName, argsText, { ok: false, output });
    }

    if (policy.requiresApproval) {
      input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: 'awaiting_approval' });
      const approved = await this.approvalGateway.requestApproval({ actionId, requestId: input.requestId, risk, toolName, summary: argsSummary, workspaceRoot: input.workspaceRoot });
      if (!approved) {
        const output = 'Tool execution was denied or approval timed out.';
        input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: 'denied', output });
        await this.recordAudit(actionId, 'denied', input, risk, toolName);
        return this.result(input.toolCall, toolName, argsText, { ok: false, output });
      }
      await this.recordAudit(actionId, 'approved', input, risk, toolName);
    }

    input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: 'running' });
    await this.recordAudit(actionId, 'started', input, risk, toolName);
    const toolResult = await this.toolExecutor.execute(toolName, args, input.workspaceRoot, input.permissionMode);
    input.eventSink.emitAction(input.requestId, { id: actionId, toolName, args: argsSummary, risk, status: toolResult.ok ? 'ok' : 'error', output: toolResult.output });
    await this.recordAudit(actionId, toolResult.ok ? 'succeeded' : 'error', input, risk, toolName);
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
}

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
