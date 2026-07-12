import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IAttachmentMessageFormatter } from '../../domain/ports/IAttachmentMessageFormatter.js';
import type { IToolApprovalGateway } from '../../domain/ports/IToolApprovalGateway.js';
import type { IToolAuditLogger } from '../../domain/ports/IToolAuditLogger.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import type { AgentTaskCheckpoint } from '../../domain/entities/agentTask.js';
import { buildSummarySystemMessage, compactContext } from '../../contextCompaction.js';
import { getInputContextTokenBudget } from '../../domain/entities/tokenBudget.js';
import type {
  AgentStartPayload,
  AgentProviderSettings,
  ChatMessage,
  Message,
} from '../../domain/entities/agent.js';

import { MAX_AGENT_STEPS_PER_RUN, MAX_AGENT_TASK_STEPS } from '../../domain/entities/limits.js';
import { buildAgentSystemPrompt } from '../services/agentSystemPrompt.js';
import { AgentToolCallRunner } from '../services/AgentToolCallRunner.js';

export class RunAgentSession {
  private readonly provider: IAiProvider;
  private readonly attachmentFormatter: IAttachmentMessageFormatter;
  private readonly toolCallRunner: AgentToolCallRunner;
  private readonly toolCatalog: IToolCatalog;
  private readonly tracer: IAgentTracer;

  constructor(
    provider: IAiProvider,
    toolExecutor: IToolExecutor,
    toolCatalog: IToolCatalog,
    attachmentFormatter: IAttachmentMessageFormatter,
    approvalGateway: IToolApprovalGateway,
    auditLogger: IToolAuditLogger,
    tracer: IAgentTracer,
  ) {
    this.provider = provider;
    this.toolCatalog = toolCatalog;
    this.attachmentFormatter = attachmentFormatter;
    this.tracer = tracer;
    this.toolCallRunner = new AgentToolCallRunner(toolExecutor, approvalGateway, auditLogger, tracer);
  }

  async execute(
    payload: AgentStartPayload,
    eventSink: IAgentEventSink,
    settings: AgentProviderSettings,
    workspaceRoot: string,
    knowledgeContext?: string,
    skillContext?: string,
    signal?: AbortSignal,
    task?: AgentTaskRun,
  ) {
    const requestId = typeof payload.requestId === 'string' ? payload.requestId : '';
    if (!requestId) {
      eventSink.emitError('', 'Thiếu requestId.');
      return;
    }

    if (!settings.model) {
      throw new Error('Chưa chọn model AI.');
    }

    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const inputContextTokens = Math.min(getInputContextTokenBudget(settings.contextWindow), settings.contextBudgetTokens ?? Number.POSITIVE_INFINITY);
    const toolDefinitions = await this.toolCatalog.list(workspaceRoot);
    const toolsByName = new Map(toolDefinitions.map((tool) => [tool.name, tool]));

    let currentMessages = task?.messages.length ? [...task.messages] : [...messages];
    let conversation: ChatMessage[] = task?.conversation.length ? [...task.conversation] : [];
    let completedSteps = task?.completedSteps ?? 0;

    const rebuildConversation = async () => {
      const compactedContext = compactContext(
        currentMessages.filter((m) => m.sender !== 'system'),
        inputContextTokens
      );
      conversation = [
        {
          role: 'system',
          content: buildAgentSystemPrompt(workspaceRoot, settings.permissionMode, knowledgeContext, skillContext),
        },
        ...(compactedContext.summary ? [{
          role: 'system' as const,
          content: buildSummarySystemMessage(compactedContext.summary),
        }] : []),
        ...await this.attachmentFormatter.format(compactedContext.recentMessages),
      ];

      if (compactedContext.didCompact) {
        const lastMsg = currentMessages[currentMessages.length - 1];
        if (!lastMsg || lastMsg.sender !== 'system' || !lastMsg.content.includes('đã được nén')) {
          currentMessages.push({
            id: `compaction-${Date.now()}`,
            sender: 'system',
            content: `Ngữ cảnh cũ đã được nén (còn lại ~${compactedContext.compactedApproxTokens} tokens) để tối ưu bộ nhớ.`,
          });
        }
      }
    };

    if (conversation.length === 0) await rebuildConversation();
    await this.checkpoint(task, 'running', completedSteps, currentMessages, conversation);

    const runStepLimit = Math.min(completedSteps + MAX_AGENT_STEPS_PER_RUN, MAX_AGENT_TASK_STEPS);
    for (let step = completedSteps; step < runStepLimit; step += 1) {
      if (signal?.aborted) throw new Error('Agent session stopped.');

      const modelStartedAt = new Date().toISOString();
      let assistantMessage: Awaited<ReturnType<IAiProvider['requestAssistantMessage']>>;
      try {
        assistantMessage = await this.provider.requestAssistantMessage(settings, conversation, toolDefinitions, eventSink, requestId, signal);
        await this.recordModelSpan(task, requestId, step, modelStartedAt, settings.model, 'succeeded', assistantMessage.finishReason);
      } catch (error) {
        await this.recordModelSpan(task, requestId, step, modelStartedAt, settings.model, 'failed');
        throw error;
      }

      const content = this.readAssistantContent(assistantMessage);
      const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];

      conversation.push({
        role: 'assistant',
        content,
        tool_calls: toolCalls,
      });

      if (toolCalls.length === 0) {
        if (assistantMessage.finishReason === 'length') {
          eventSink.emitChunk(requestId, '\n\n[Phản hồi bị cắt vì chạm giới hạn output token. Hãy gửi "tiếp tục" nếu muốn AI viết tiếp phần còn lại.]');
        } else if (assistantMessage.finishReason === 'stream_closed') {
          eventSink.emitChunk(requestId, '\n\n[Stream từ server đóng trước khi gửi tín hiệu kết thúc. Nội dung phía trên có thể chưa hoàn chỉnh.]');
        }
        await this.checkpoint(task, 'completed', completedSteps, currentMessages, conversation);
        eventSink.emitDone(requestId);
        return { status: 'completed' as const, completedSteps };
      }

      let stepContent = content;

      for (const toolCall of toolCalls) {
        if (signal?.aborted) throw new Error('Agent session stopped.');
        const toolName = toolCall.function?.name || '';
        const result = await this.toolCallRunner.run({
          eventSink,
          permissionMode: settings.permissionMode,
          requestId,
          step,
          toolCall,
          workspaceRoot,
          toolDefinition: toolsByName.get(toolName),
          traceContext: task ? { traceId: task.traceId, taskId: task.id } : undefined,
        });
        conversation.push(result.toolMessage);
        stepContent += result.stepContent;
      }

      // Lưu lại kết quả của step hiện tại dưới dạng CompactableMessage để có thể compact ở step sau
      currentMessages.push({
        id: `step-${step}`,
        sender: 'agent',
        content: stepContent,
      });
      completedSteps = step + 1;

      // Mid-session compaction check: nếu conversation quá dài, build lại
      const roughConversationTokens = conversation.reduce((acc, msg) => acc + Math.ceil(JSON.stringify(msg).length / 4), 0);
      if (roughConversationTokens > inputContextTokens) {
        await rebuildConversation();
      }
      await this.checkpoint(task, 'running', completedSteps, currentMessages, conversation);
    }

    const budgetMessage = completedSteps >= MAX_AGENT_TASK_STEPS
      ? `\n\nAgent dừng vì đã dùng hết ngân sách ${MAX_AGENT_TASK_STEPS} bước của tác vụ.`
      : `\n\nAgent đã checkpoint sau ${completedSteps} bước. Bạn có thể tiếp tục tác vụ.`;
    await this.checkpoint(task, 'paused', completedSteps, currentMessages, conversation);
    eventSink.emitChunk(requestId, budgetMessage);
    eventSink.emitDone(requestId);
    return { status: 'paused' as const, completedSteps };
  }

  private async checkpoint(
    task: AgentTaskRun | undefined,
    status: AgentTaskCheckpoint['status'],
    completedSteps: number,
    messages: Message[],
    conversation: ChatMessage[],
  ) {
    if (!task?.onCheckpoint) return;
    await task.onCheckpoint({
      id: task.id,
      traceId: task.traceId,
      workspaceRoot: task.workspaceRoot,
      status,
      completedSteps,
      messages,
      conversation,
      knowledgeContext: task.knowledgeContext,
    });
  }

  private async recordModelSpan(task: AgentTaskRun | undefined, requestId: string, step: number, startedAt: string, model: string, status: 'succeeded' | 'failed', finishReason?: string) {
    if (!task) return;
    await this.tracer.recordSpan({ kind: 'model_call', traceId: task.traceId, taskId: task.id, requestId, step, startedAt, endedAt: new Date().toISOString(), status, model, finishReason }).catch(() => undefined);
  }

  private readAssistantContent(message: ChatMessage) {
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      return message.content.map((part) => typeof part === 'object' && part !== null && typeof part.text === 'string' ? part.text : '').join('');
    }
    return '';
  }
}

export type AgentTaskRun = {
  id: string;
  traceId: string;
  workspaceRoot: string;
  completedSteps: number;
  messages: Message[];
  conversation: ChatMessage[];
  knowledgeContext?: string;
  onCheckpoint?: (checkpoint: AgentTaskCheckpoint) => Promise<void>;
};
