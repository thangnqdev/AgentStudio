import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { IToolCatalog } from '../../domain/ports/IToolCatalog.js';
import type { IAttachmentMessageFormatter } from '../../domain/ports/IAttachmentMessageFormatter.js';
import type { IToolApprovalGateway } from '../../domain/ports/IToolApprovalGateway.js';
import type { IToolAuditLogger } from '../../domain/ports/IToolAuditLogger.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import type { IToolPermissionPolicy } from '../../domain/ports/IToolPermissionPolicy.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';
import type { IAgentWorkspaceScope } from '../../domain/ports/IAgentWorkspaceScope.js';
import type { AgentTaskCheckpoint } from '../../domain/entities/agentTask.js';
import { createAgentRunState, transitionAgentRun } from '../../domain/entities/agentRunState.js';
import { getInputContextTokenBudget } from '../../domain/entities/tokenBudget.js';
import type {
  AgentStartPayload,
  AgentProviderSettings,
  ChatMessage,
  Message,
} from '../../domain/entities/agent.js';

import { MAX_AGENT_STEPS_PER_RUN, MAX_AGENT_TASK_STEPS } from '../../domain/entities/limits.js';
import { AgentToolCallRunner } from '../services/AgentToolCallRunner.js';
import { AgentToolBatchRunner } from '../services/AgentToolBatchRunner.js';
import { ResilientModelRequester } from '../services/ResilientModelRequester.js';
import { contextProjectionPolicy, projectConversationForModel } from '../services/conversationProjection.js';
import { AgentConversationBuilder } from '../services/AgentConversationBuilder.js';
import { OUTPUT_CONTINUATION_PROMPT, shouldContinueModelOutput } from '../services/outputContinuation.js';
import { readAssistantContent } from '../services/assistantMessage.js';
import { buildAgentSystemPrompt } from '../services/agentSystemPrompt.js';

export class RunAgentSession {
  private readonly modelRequester: ResilientModelRequester;
  private readonly conversationBuilder: AgentConversationBuilder;
  private readonly toolBatchRunner: AgentToolBatchRunner;
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
    permissionPolicy?: IToolPermissionPolicy,
    hooks?: ILifecycleHookDispatcher,
  ) {
    this.modelRequester = new ResilientModelRequester(provider);
    this.toolCatalog = toolCatalog;
    this.conversationBuilder = new AgentConversationBuilder(attachmentFormatter);
    this.tracer = tracer;
    this.toolBatchRunner = new AgentToolBatchRunner(new AgentToolCallRunner(toolExecutor, approvalGateway, auditLogger, tracer, permissionPolicy, hooks));
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
    workspaceScope?: IAgentWorkspaceScope,
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
    const currentWorkspaceRoot = () => workspaceScope?.currentRoot(workspaceRoot) ?? workspaceRoot;
    const toolDefinitions = await this.toolCatalog.list(currentWorkspaceRoot());
    const toolsByName = new Map(toolDefinitions.map((tool) => [tool.name, tool]));

    let currentMessages = task?.messages.length ? [...task.messages] : [...messages];
    let conversation: ChatMessage[] = task?.conversation.length ? [...task.conversation] : [];
    let runState = createAgentRunState(task?.completedSteps ?? 0);
    let outputContinuations = 0;

    const rebuildConversation = async () => {
      const rebuilt = await this.conversationBuilder.build({
        messages: currentMessages, inputContextTokens, workspaceRoot: currentWorkspaceRoot(), settings, knowledgeContext, skillContext,
      });
      conversation = rebuilt.conversation;
      if (rebuilt.compactionNotice) currentMessages.push(rebuilt.compactionNotice);
    };

    if (conversation.length === 0) await rebuildConversation();
    await this.checkpoint(task, 'running', runState.completedSteps, currentMessages, conversation);

    const runStepLimit = Math.min(runState.completedSteps + MAX_AGENT_STEPS_PER_RUN, MAX_AGENT_TASK_STEPS);
    while (runState.phase === 'ready' && runState.completedSteps < runStepLimit) {
      if (signal?.aborted) {
        runState = transitionAgentRun(runState, { type: 'stop' });
        throw new Error('Agent session stopped.');
      }

      const step = runState.completedSteps;
      synchronizeSystemPrompt(conversation, buildAgentSystemPrompt(
        currentWorkspaceRoot(), settings.permissionMode, knowledgeContext, skillContext,
      ));
      runState = transitionAgentRun(runState, { type: 'request_model' });
      const modelStartedAt = new Date().toISOString();
      let assistantMessage: Awaited<ReturnType<IAiProvider['requestAssistantMessage']>>;
      try {
        const projectedConversation = projectConversationForModel(conversation, contextProjectionPolicy(inputContextTokens));
        const outcome = await this.modelRequester.execute({ settings, messages: projectedConversation.messages, tools: toolDefinitions, eventSink, requestId, signal });
        assistantMessage = outcome.response;
        await this.recordModelSpan(task, requestId, step, modelStartedAt, outcome.model, 'succeeded', assistantMessage.finishReason, assistantMessage.usage);
      } catch (error) {
        await this.recordModelSpan(task, requestId, step, modelStartedAt, settings.model, 'failed');
        throw error;
      }

      const content = readAssistantContent(assistantMessage);
      const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];
      const requiresContinuation = toolCalls.length === 0
        && shouldContinueModelOutput(assistantMessage.finishReason, outputContinuations);
      runState = transitionAgentRun(runState, {
        type: 'model_response', hasToolCalls: toolCalls.length > 0, requiresContinuation,
      });

      conversation.push({
        role: 'assistant',
        content,
        tool_calls: toolCalls,
      });

      if (toolCalls.length === 0) {
        if (requiresContinuation) {
          outputContinuations += 1;
          currentMessages.push({ id: `continuation-${Date.now()}-${outputContinuations}`, sender: 'agent', content });
          conversation.push({ role: 'user', content: OUTPUT_CONTINUATION_PROMPT });
          await this.checkpoint(task, 'running', runState.completedSteps, currentMessages, conversation);
          eventSink.emitChunk(requestId, '\n\n');
          continue;
        }
        if (assistantMessage.finishReason === 'length') {
          eventSink.emitChunk(requestId, '\n\n[Phản hồi bị cắt vì chạm giới hạn output token. Hãy gửi "tiếp tục" nếu muốn AI viết tiếp phần còn lại.]');
        } else if (assistantMessage.finishReason === 'stream_closed') {
          eventSink.emitChunk(requestId, '\n\n[Stream từ server đóng trước khi gửi tín hiệu kết thúc. Nội dung phía trên có thể chưa hoàn chỉnh.]');
        }
        await this.checkpoint(task, 'completed', runState.completedSteps, currentMessages, conversation);
        eventSink.emitDone(requestId);
        return { status: 'completed' as const, completedSteps: runState.completedSteps };
      }

      let stepContent = content;

      const toolResults = await this.toolBatchRunner.run({
        eventSink,
        permissionMode: settings.permissionMode,
        requestId,
        step,
        toolCalls,
        toolsByName,
        workspaceRoot: currentWorkspaceRoot(),
        workspaceRootProvider: currentWorkspaceRoot,
        traceContext: task ? { traceId: task.traceId, taskId: task.id } : undefined,
        signal,
      });
      for (const result of toolResults) {
        conversation.push(result.toolMessage);
        stepContent += result.stepContent;
      }

      currentMessages.push({
        id: `step-${step}`,
        sender: 'agent',
        content: stepContent,
      });
      const pendingMessages = await task?.drainMessages?.() ?? [];
      currentMessages.push(...pendingMessages);
      conversation.push(...pendingMessages.map((message) => ({ role: 'user' as const, content: message.content })));
      runState = transitionAgentRun(runState, { type: 'tools_completed' });

      const roughConversationTokens = conversation.reduce((acc, msg) => acc + Math.ceil(JSON.stringify(msg).length / 4), 0);
      if (roughConversationTokens > inputContextTokens) {
        await rebuildConversation();
      }
      await this.checkpoint(task, 'running', runState.completedSteps, currentMessages, conversation);
      runState = transitionAgentRun(runState, { type: 'checkpoint_saved' });
    }

    const pauseReason = runState.completedSteps >= MAX_AGENT_TASK_STEPS ? 'task_step_limit' : 'run_step_limit';
    runState = transitionAgentRun(runState, { type: 'pause', reason: pauseReason });
    const budgetMessage = runState.completedSteps >= MAX_AGENT_TASK_STEPS
      ? `\n\nAgent dừng vì đã dùng hết ngân sách ${MAX_AGENT_TASK_STEPS} bước của tác vụ.`
      : `\n\nAgent đã checkpoint sau ${runState.completedSteps} bước. Bạn có thể tiếp tục tác vụ.`;
    await this.checkpoint(task, 'paused', runState.completedSteps, currentMessages, conversation);
    eventSink.emitChunk(requestId, budgetMessage);
    eventSink.emitDone(requestId);
    return { status: 'paused' as const, completedSteps: runState.completedSteps };
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

  private async recordModelSpan(task: AgentTaskRun | undefined, requestId: string, step: number, startedAt: string, model: string, status: 'succeeded' | 'failed', finishReason?: string, usage?: { inputTokens: number; outputTokens: number; totalTokens: number; cachedInputTokens?: number }) {
    if (!task) return;
    await this.tracer.recordSpan({ kind: 'model_call', traceId: task.traceId, taskId: task.id, requestId, step, startedAt, endedAt: new Date().toISOString(), status, model, finishReason, usage }).catch(() => undefined);
  }

}

function synchronizeSystemPrompt(conversation: ChatMessage[], content: string) {
  const systemMessage: ChatMessage = { role: 'system', content };
  if (conversation[0]?.role === 'system') conversation[0] = systemMessage;
  else conversation.unshift(systemMessage);
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
  drainMessages?: () => Promise<Message[]>;
};
