import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import type { IAttachmentMessageFormatter } from '../../domain/ports/IAttachmentMessageFormatter.js';
import { buildSummarySystemMessage, compactContext } from '../../contextCompaction.js';
import { getInputContextTokenBudget } from '../../domain/entities/tokenBudget.js';
import type {
  AgentStartPayload,
  AgentProviderSettings,
  ChatMessage,
  PermissionMode,
} from '../../domain/entities/agent.js';

import { MAX_AGENT_STEPS } from '../../domain/entities/limits.js';

export class RunAgentSession {
  private readonly provider: IAiProvider;
  private readonly toolExecutor: IToolExecutor;
  private readonly attachmentFormatter: IAttachmentMessageFormatter;

  constructor(provider: IAiProvider, toolExecutor: IToolExecutor, attachmentFormatter: IAttachmentMessageFormatter) {
    this.provider = provider;
    this.toolExecutor = toolExecutor;
    this.attachmentFormatter = attachmentFormatter;
  }

  async execute(
    payload: AgentStartPayload,
    eventSink: IAgentEventSink,
    settings: AgentProviderSettings,
    workspaceRoot: string,
    knowledgeContext?: string,
    signal?: AbortSignal,
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
    const inputContextTokens = getInputContextTokenBudget(settings.contextWindow);

    let currentMessages = [...messages];
    let conversation: ChatMessage[] = [];

    const rebuildConversation = async () => {
      const compactedContext = compactContext(currentMessages, inputContextTokens);
      conversation = [
        {
          role: 'system',
          content: this.buildAgentSystemPrompt(workspaceRoot, settings.permissionMode, knowledgeContext),
        },
        ...(compactedContext.summary ? [{
          role: 'system' as const,
          content: buildSummarySystemMessage(compactedContext.summary),
        }] : []),
        ...await this.attachmentFormatter.format(compactedContext.recentMessages),
      ];
    };

    await rebuildConversation();

    for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
      if (signal?.aborted) throw new Error('Agent session stopped.');

      const assistantMessage = await this.provider.requestAssistantMessage(
        settings,
        conversation,
        eventSink,
        requestId,
        signal,
      );

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
        eventSink.emitDone(requestId);
        return;
      }

      let stepContent = content;

      for (const toolCall of toolCalls) {
        const toolName = toolCall.function?.name || '';
        const args = this.parseToolArguments(toolCall.function?.arguments || '{}');
        const actionId = toolCall.id || `${requestId}-${toolName}-${step}`;
        const argsText = JSON.stringify(args);

        eventSink.emitAction(requestId, {
          id: actionId,
          toolName,
          args: argsText,
          status: 'running',
        });

        const result = await this.toolExecutor.execute(toolName, args, workspaceRoot, settings.permissionMode);

        eventSink.emitAction(requestId, {
          id: actionId,
          toolName,
          args: argsText,
          status: result.ok ? 'ok' : 'error',
          output: result.output,
        });

        conversation.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });

        stepContent += `\n[tool:${toolName}] ${argsText}\n${result.ok ? '[ok]' : '[blocked/error]'}\n${result.output}\n`;
      }

      // Lưu lại kết quả của step hiện tại dưới dạng CompactableMessage để có thể compact ở step sau
      currentMessages.push({
        id: `step-${step}`,
        sender: 'agent',
        content: stepContent,
      });

      // Mid-session compaction check: nếu conversation quá dài, build lại
      const roughConversationTokens = conversation.reduce((acc, msg) => acc + Math.ceil(JSON.stringify(msg).length / 4), 0);
      if (roughConversationTokens > inputContextTokens) {
        await rebuildConversation();
      }
    }

    eventSink.emitChunk(requestId, '\n\nAgent dừng vì đạt giới hạn số bước. Hãy thu hẹp yêu cầu hoặc chạy tiếp.');
    eventSink.emitDone(requestId);
  }

  private buildAgentSystemPrompt(workspaceRoot: string, permissionMode: PermissionMode, knowledgeContext?: string) {
    return [
      'You are AgentStudio, a local coding agent embedded in an Electron app.',
      'Use tools when you need to inspect, edit, or test the project. Explain concise progress to the user.',
      `Workspace root: ${workspaceRoot}`,
      `Permission mode: ${permissionMode}`,
      'Permission rules:',
      '- read-only: inspect only; write_file and run_command are blocked.',
      '- workspace-write: read/write only inside workspace; commands run through the sandbox executor.',
      '- danger-full-access: commands run without sandbox and file paths may be absolute.',
      'Do not claim a command or edit succeeded unless the tool result says it did.',
      'If earlier context was compacted, treat its summary as lossy. Re-read files or rerun lightweight checks when exact details matter.',
      knowledgeContext || '',
    ].join('\n');
  }

  private parseToolArguments(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  private readAssistantContent(message: ChatMessage) {
    if (typeof message.content === 'string') return message.content;
    if (Array.isArray(message.content)) {
      return message.content.map((part) => typeof part === 'object' && part !== null && typeof part.text === 'string' ? part.text : '').join('');
    }
    return '';
  }
}
