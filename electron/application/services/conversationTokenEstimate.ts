import type { ChatMessage } from '../../domain/entities/agent.js';

const ESTIMATED_IMAGE_CHARACTERS = 4_000;

export function estimateConversationTokens(messages: ChatMessage[]): number {
  const characters = messages.reduce((total, message) => total + estimateValueCharacters(message, new WeakSet()), 0);
  return Math.ceil(characters / 4);
}

function estimateValueCharacters(value: unknown, seen: WeakSet<object>): number {
  if (typeof value === 'string') {
    return value.startsWith('data:image/') && value.includes(';base64,')
      ? ESTIMATED_IMAGE_CHARACTERS
      : value.length;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).length;
  if (value === null || value === undefined) return 0;
  if (typeof value !== 'object' || seen.has(value)) return 0;
  seen.add(value);
  if (Array.isArray(value)) return value.reduce((total, item) => total + estimateValueCharacters(item, seen), 0);
  return Object.entries(value).reduce((total, [key, item]) => total + key.length + estimateValueCharacters(item, seen), 0);
}
