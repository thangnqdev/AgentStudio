import type { ChatThread } from '../../domain/entities/chatThread';
import { deriveThreadTitle } from '../../domain/entities/chatThread';
import type { Message } from '../../domain/entities/message';

export interface ActiveChatState {
  messages: Message[];
  threads: ChatThread[];
  activeThreadId: string | null;
  activeTask: string | null;
}

interface SyncThreadDependencies {
  createId: () => string;
  now: () => Date;
}

export function syncActiveThread(
  state: ActiveChatState,
  messages: Message[],
  dependencies: SyncThreadDependencies,
): ActiveChatState {
  const activeThreadId = state.activeThreadId ?? dependencies.createId();
  const existingThread = state.threads.find((thread) => thread.id === activeThreadId);
  const title = existingThread?.customTitle
    ? existingThread.title
    : deriveThreadTitle(messages, existingThread?.title ?? 'Chat mới');
  const timestamp = dependencies.now();
  const updatedThread: ChatThread = {
    id: activeThreadId,
    title,
    ...(existingThread?.customTitle ? { customTitle: true } : {}),
    messages,
    createdAt: existingThread?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  const threads = existingThread
    ? state.threads.map((thread) => (thread.id === activeThreadId ? updatedThread : thread))
    : [updatedThread, ...state.threads];

  return {
    messages,
    threads,
    activeThreadId,
    activeTask: title,
  };
}

export function findRetryUserMessage(messages: Message[], agentMessageId: string): Message | null {
  const agentIndex = messages.findIndex((message) => message.id === agentMessageId && message.sender === 'agent');
  if (agentIndex < 0) return null;
  for (let index = agentIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.sender === 'user') return message;
  }
  return null;
}
