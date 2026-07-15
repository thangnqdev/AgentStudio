import type { AgentProviderSettings, ChatMessage, Message } from '../../domain/entities/agent.js';
import type { IAttachmentMessageFormatter } from '../../domain/ports/IAttachmentMessageFormatter.js';
import { buildSummarySystemMessage, compactContext } from '../../contextCompaction.js';
import { buildAgentSystemPrompt } from './agentSystemPrompt.js';
import { restoreHistoricalToolConversation } from './historicalToolConversation.js';

export class AgentConversationBuilder {
  private readonly attachmentFormatter: IAttachmentMessageFormatter;

  constructor(attachmentFormatter: IAttachmentMessageFormatter) {
    this.attachmentFormatter = attachmentFormatter;
  }

  async build(input: {
    messages: Message[];
    inputContextTokens: number;
    workspaceRoot: string;
    settings: AgentProviderSettings;
    knowledgeContext?: string;
    skillContext?: string;
  }): Promise<{ conversation: ChatMessage[]; compactionNotice?: Message }> {
    const compacted = compactContext(
      input.messages.filter((message) => message.sender !== 'system'),
      input.inputContextTokens,
    );
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

    if (!compacted.didCompact || hasRecentCompactionNotice(input.messages)) return { conversation };
    return {
      conversation,
      compactionNotice: {
        id: `compaction-${Date.now()}`,
        sender: 'system',
        content: `Ngữ cảnh cũ đã được nén (còn lại ~${compacted.compactedApproxTokens} tokens) để tối ưu bộ nhớ.`,
      },
    };
  }
}

function hasRecentCompactionNotice(messages: Message[]) {
  const last = messages.at(-1);
  return last?.sender === 'system' && last.content.includes('đã được nén');
}
