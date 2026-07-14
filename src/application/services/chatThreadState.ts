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
  const title = deriveThreadTitle(messages, existingThread?.title ?? 'Chat mới');
  const timestamp = dependencies.now();
  const updatedThread: ChatThread = {
    id: activeThreadId,
    title,
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
