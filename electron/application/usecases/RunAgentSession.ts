import type { IAgentEventSink } from '../../domain/ports/IAgentEventSink.js';
import type { IAiProvider } from '../../domain/ports/IAiProvider.js';
import type { IToolExecutor } from '../../domain/ports/IToolExecutor.js';
import { buildSummarySystemMessage, compactContext } from '../../contextCompaction.js';
import { getInputContextTokenBudget } from '../../domain/entities/tokenBudget.js';
import type {
  AgentStartPayload,
  AgentProviderSettings,
  Message,
  ChatMessage,
  PermissionMode,
  Attachment,
} from '../../domain/entities/agent.js';
import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_AGENT_STEPS = 30;
const MAX_FILE_BYTES = 200_000;
const MAX_IMAGE_BYTES = 5_000_000;

export class RunAgentSession {
  private readonly provider: IAiProvider;
  private readonly toolExecutor: IToolExecutor;

  constructor(provider: IAiProvider, toolExecutor: IToolExecutor) {
    this.provider = provider;
    this.toolExecutor = toolExecutor;
  }

  async execute(
    payload: AgentStartPayload,
    eventSink: IAgentEventSink,
    settings: AgentProviderSettings,
    workspaceRoot: string,
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
    const compactedContext = compactContext(messages, inputContextTokens);
    const conversation: ChatMessage[] = [
      {
        role: 'system',
        content: this.buildAgentSystemPrompt(workspaceRoot, settings.permissionMode),
      },
      ...(compactedContext.summary ? [{
        role: 'system' as const,
        content: buildSummarySystemMessage(compactedContext.summary),
      }] : []),
      ...await this.formatMessages(compactedContext.recentMessages),
    ];

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
      }
    }

    eventSink.emitChunk(requestId, '\n\nAgent dừng vì đạt giới hạn số bước. Hãy thu hẹp yêu cầu hoặc chạy tiếp.');
    eventSink.emitDone(requestId);
  }

  private buildAgentSystemPrompt(workspaceRoot: string, permissionMode: PermissionMode) {
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
    ].join('\n');
  }

  // ─── Attachment formatting (reads from disk — acceptable in use-case since it
  //     prepares the AI context payload, not executing tools) ────────────────────

  private async formatMessages(messages: Message[]): Promise<ChatMessage[]> {
    const formattedMessages: ChatMessage[] = [];

    for (const message of messages) {
      if (!Array.isArray(message.attachments) || message.attachments.length === 0) {
        formattedMessages.push({
          role: message.sender === 'user' ? 'user' : 'assistant',
          content: message.content,
        });
        continue;
      }

      const parts: Array<Record<string, unknown>> = [];
      for (const attachment of message.attachments) {
        if (attachment.type === 'image') {
          const imageUrl = await this.readAttachmentImageUrl(attachment);
          if (imageUrl) {
            parts.push({ type: 'image_url', image_url: { url: imageUrl } });
          } else {
            parts.push({ type: 'text', text: this.describeAttachment(attachment) });
          }
        } else if (attachment.type === 'text') {
          parts.push({ type: 'text', text: await this.readAttachmentText(attachment) });
        } else {
          parts.push({ type: 'text', text: this.describeAttachment(attachment) });
        }
      }

      if (message.content) {
        parts.push({ type: 'text', text: message.content });
      }

      formattedMessages.push({
        role: message.sender === 'user' ? 'user' : 'assistant',
        content: parts,
      });
    }

    return formattedMessages;
  }

  private async readAttachmentText(attachment: Attachment) {
    if (attachment.data) {
      return `[File: ${attachment.name}]\n\`\`\`\n${attachment.data}\n\`\`\``;
    }

    if (!attachment.filePath) {
      return this.describeAttachment(attachment);
    }

    try {
      const stat = await fs.stat(attachment.filePath);
      if (!stat.isFile()) return `${this.describeAttachment(attachment)}\nPath is not a file.`;
      if (stat.size > MAX_FILE_BYTES) {
        return `${this.describeAttachment(attachment)}\nFile is too large to inline (${stat.size} bytes). Read it with tools only if needed.`;
      }

      return `[File: ${attachment.name}]\nPath: ${attachment.filePath}\n\`\`\`\n${await fs.readFile(attachment.filePath, 'utf8')}\n\`\`\``;
    } catch (error) {
      return `${this.describeAttachment(attachment)}\nCould not read file: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
  }

  private async readAttachmentImageUrl(attachment: Attachment) {
    if (attachment.data) return attachment.data;
    if (!attachment.filePath) return '';

    try {
      const stat = await fs.stat(attachment.filePath);
      if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) return '';
      const mimeType = attachment.mimeType || this.inferMimeType(attachment.name) || 'image/png';
      const data = await fs.readFile(attachment.filePath);
      return `data:${mimeType};base64,${data.toString('base64')}`;
    } catch {
      return '';
    }
  }

  private describeAttachment(attachment: Attachment) {
    return [
      `[${attachment.type} attachment: ${attachment.name}]`,
      attachment.filePath ? `Path: ${attachment.filePath}` : '',
      attachment.size ? `Size: ${attachment.size} bytes` : '',
      attachment.mimeType ? `MIME: ${attachment.mimeType}` : '',
    ].filter(Boolean).join('\n');
  }

  private inferMimeType(fileName: string) {
    const extension = path.extname(fileName).toLowerCase();
    if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
    if (extension === '.png') return 'image/png';
    if (extension === '.gif') return 'image/gif';
    if (extension === '.webp') return 'image/webp';
    return '';
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
