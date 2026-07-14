import type { ChatMessage } from '../../domain/entities/agent.js';

export function readAssistantContent(message: ChatMessage) {
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content
    .map((part) => typeof part === 'object' && part !== null && typeof part.text === 'string' ? part.text : '')
    .join('');
}
