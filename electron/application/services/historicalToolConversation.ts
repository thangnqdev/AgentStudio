import type { ChatMessage, Message } from '../../domain/entities/agent.js';

export function restoreHistoricalToolConversation(
  messages: Message[],
  formattedMessages: ChatMessage[],
): ChatMessage[] {
  if (messages.length !== formattedMessages.length) {
    throw new Error('Formatted conversation no longer matches source messages.');
  }
  return messages.flatMap((message, index) => {
    const formatted = formattedMessages[index];
    const actions = message.sender === 'agent' ? message.actions ?? [] : [];
    if (actions.length === 0) return [formatted];
    const calls = actions.map((action, actionIndex) => ({
      id: historicalCallId(message.id, actionIndex),
      type: 'function',
      function: { name: action.toolName, arguments: '{}' },
    }));
    const results: ChatMessage[] = actions.map((action, actionIndex) => ({
      role: 'tool',
      tool_call_id: calls[actionIndex].id,
      content: JSON.stringify({
        ok: action.status === 'ok',
        output: action.output || `Historical tool action status: ${action.status}`,
      }),
    }));
    const finalText = hasContent(formatted.content) ? [formatted] : [];
    return [{ role: 'assistant' as const, content: '', tool_calls: calls }, ...results, ...finalText];
  });
}

function historicalCallId(messageId: string, actionIndex: number) {
  const normalized = messageId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'message';
  return `history-${normalized}-${actionIndex}`;
}

function hasContent(content: unknown) {
  if (typeof content === 'string') return content.length > 0;
  return Array.isArray(content) ? content.length > 0 : content !== null && content !== undefined;
}
