import type { ChatMessage } from '../../domain/entities/agent.js';

export function synchronizeSystemPrompt(conversation: ChatMessage[], content: string) {
  const systemMessage: ChatMessage = { role: 'system', content };
  if (conversation[0]?.role === 'system') conversation[0] = systemMessage;
  else conversation.unshift(systemMessage);
}
