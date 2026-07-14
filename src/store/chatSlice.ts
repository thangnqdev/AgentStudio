import { syncActiveThread } from '../application/services/chatThreadState';
import type { ChatThread } from '../domain/entities/chatThread';
import { createBlankThread, reviveThread } from '../domain/entities/chatThread';
import type { AgentSlice, AppSlice, ChatSlice } from './appStoreTypes';

const idleAgentState = (): Pick<
  AgentSlice,
  'activeRequestId' | 'agentActions' | 'agentThoughts' | 'agentThoughtStartsNewLine' | 'isAgentTyping'
> => ({
  activeRequestId: null,
  agentActions: [],
  agentThoughts: [],
  agentThoughtStartsNewLine: true,
  isAgentTyping: false,
});

const syncMessages = (
  state: Parameters<typeof syncActiveThread>[0],
  messages: Parameters<typeof syncActiveThread>[1],
) => syncActiveThread(state, messages, {
  createId: () => crypto.randomUUID(),
  now: () => new Date(),
});

export const createChatSlice: AppSlice<ChatSlice> = (set, get) => {
  const initialThread = createBlankThread('Chat mới');

  return {
    activeTask: initialThread.title,
    messages: [],
    threads: [initialThread],
    activeThreadId: initialThread.id,
    setActiveTask: (activeTask) => set({ activeTask }),
    createThread: (title = 'Chat mới') => {
      const thread = createBlankThread(title);
      set((state) => ({
        threads: [thread, ...state.threads],
        activeThreadId: thread.id,
        messages: [],
        activeTask: thread.title,
        activeView: 'tasks',
        ...idleAgentState(),
      }));
      return thread.id;
    },
    switchThread: (threadId) => set((state) => {
      const thread = state.threads.find((item) => item.id === threadId);
      if (!thread) return {};
      return {
        activeThreadId: thread.id,
        messages: thread.messages,
        activeTask: thread.title,
        activeView: 'tasks',
        ...idleAgentState(),
      };
    }),
    deleteThread: (threadId) => set((state) => {
      const remainingThreads = state.threads.filter((thread) => thread.id !== threadId);
      const fallbackThread = remainingThreads[0] ?? createBlankThread('Chat mới');
      const threads = remainingThreads.length > 0 ? remainingThreads : [fallbackThread];
      const shouldSwitch = state.activeThreadId === threadId;
      return {
        threads,
        activeThreadId: shouldSwitch ? fallbackThread.id : state.activeThreadId,
        messages: shouldSwitch ? fallbackThread.messages : state.messages,
        activeTask: shouldSwitch ? fallbackThread.title : state.activeTask,
        ...(shouldSwitch ? idleAgentState() : {}),
      };
    }),
    replaceChatHistory: (threads, activeThreadId) => set(() => {
      const revivedThreads = reviveThreads(threads);
      const activeThread = revivedThreads.find((thread) => thread.id === activeThreadId)
        ?? revivedThreads[0];
      return {
        threads: revivedThreads,
        activeThreadId: activeThread.id,
        messages: activeThread.messages,
        activeTask: activeThread.title,
        activeView: 'tasks',
        ...idleAgentState(),
      };
    }),
    addMessage: (message) => {
      const id = message.id ?? crypto.randomUUID();
      const newMessage = {
        ...message,
        id,
        timestamp: new Date(),
        status: message.status ?? 'done' as const,
      };
      set((state) => syncMessages(state, [...state.messages, newMessage]));
      return id;
    },
    updateMessage: (id, update) => set((state) => syncMessages(
      state,
      state.messages.map((message) => (message.id === id ? { ...message, ...update } : message)),
    )),
    appendMessageContent: (id, chunk) => set((state) => syncMessages(
      state,
      state.messages.map((message) => (
        message.id === id ? { ...message, content: message.content + chunk } : message
      )),
    )),
    clearMessages: () => set((state) => syncMessages(state, [])),
    replaceUserMessageAndTrim: (id, content) => {
      const state = get();
      const index = state.messages.findIndex((message) => (
        message.id === id && message.sender === 'user'
      ));
      if (index < 0) return state.messages;
      const messages = state.messages.slice(0, index + 1).map((message, messageIndex) => (
        messageIndex === index ? { ...message, content, timestamp: new Date() } : message
      ));
      set((currentState) => syncMessages(currentState, messages));
      return messages;
    },
  };
};

function reviveThreads(threads: ChatThread[]): ChatThread[] {
  return threads.length > 0
    ? threads.map(reviveThread)
    : [createBlankThread('Chat mới')];
}
