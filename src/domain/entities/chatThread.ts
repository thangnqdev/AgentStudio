import type { Message } from './message';

export interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export function createBlankThread(title = 'Chat mới'): ChatThread {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function deriveThreadTitle(messages: Message[], fallback = 'Chat mới') {
  const firstUserMessage = messages.find((message) => message.sender === 'user' && message.content.trim());
  if (!firstUserMessage) return fallback;

  const title = firstUserMessage.content.trim().replace(/\s+/g, ' ');
  return title.length > 42 ? `${title.slice(0, 42)}...` : title;
}

export function reviveMessage(message: Message): Message {
  return {
    ...message,
    timestamp: new Date(message.timestamp),
  };
}

export function reviveThread(thread: ChatThread): ChatThread {
  return {
    ...thread,
    messages: Array.isArray(thread.messages) ? thread.messages.map(reviveMessage) : [],
    createdAt: new Date(thread.createdAt),
    updatedAt: new Date(thread.updatedAt),
  };
}
