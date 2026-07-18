import type { AgentProviderSettings, ChatMessage, Message } from '../../domain/entities/agent.js';
import type { IAttachmentMessageFormatter } from '../../domain/ports/IAttachmentMessageFormatter.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';
import { buildSummarySystemMessage, compactContext } from '../../contextCompaction.js';
import { buildAgentSystemPrompt } from './agentSystemPrompt.js';
import { restoreHistoricalToolConversation } from './historicalToolConversation.js';

export class AgentConversationBuilder {
  private readonly attachmentFormatter: IAttachmentMessageFormatter;
  private readonly hooks?: ILifecycleHookDispatcher;

  constructor(attachmentFormatter: IAttachmentMessageFormatter, hooks?: ILifecycleHookDispatcher) {
    this.attachmentFormatter = attachmentFormatter;
    this.hooks = hooks;
  }

  async build(input: {
    messages: Message[];
    inputContextTokens: number;
    workspaceRoot: string;
    settings: AgentProviderSettings;
    knowledgeContext?: string;
    skillContext?: string;
    requestId?: string;
    taskId?: string;
  }): Promise<{ conversation: ChatMessage[]; compactionNotice?: Message }> {
    const compacted = compactContext(
      input.messages.filter((message) => message.sender !== 'system'),
      input.inputContextTokens,
    );
    if (compacted.didCompact) await this.dispatch('PreCompact', input);
    const formattedMessages = await this.attachmentFormatter.format(compacted.recentMessages);
    const conversation: ChatMessage[] = [
      {
        role: 'system',
        content: buildAgentSystemPrompt(
          input.workspaceRoot,
          input.settings.permissionMode,
          input.knowledgeContext,
          input.skillContext,
        ),
      },
      ...(compacted.summary ? [{
        role: 'system' as const,
        content: buildSummarySystemMessage(compacted.summary),
      }] : []),
      ...restoreHistoricalToolConversation(compacted.recentMessages, formattedMessages),
    ];

    const result: { conversation: ChatMessage[]; compactionNotice?: Message } =
      !compacted.didCompact || hasRecentCompactionNotice(input.messages) ? { conversation } : {
      conversation,
      compactionNotice: {
        id: `compaction-${Date.now()}`,
        sender: 'system',
        content: `Ngữ cảnh cũ đã được nén (còn lại ~${compacted.compactedApproxTokens} tokens) để tối ưu bộ nhớ.`,
      },
    };
    if (compacted.didCompact) await this.dispatch('PostCompact', input);
    return result;
  }

  private async dispatch(
    event: 'PreCompact' | 'PostCompact',
    input: { workspaceRoot: string; requestId?: string; taskId?: string },
  ) {
    await this.hooks?.dispatch({ event, workspaceRoot: input.workspaceRoot, requestId: input.requestId, taskId: input.taskId })
      .catch(() => undefined);
  }
}

function hasRecentCompactionNotice(messages: Message[]) {
  const last = messages.at(-1);
  return last?.sender === 'system' && last.content.includes('đã được nén');
}
