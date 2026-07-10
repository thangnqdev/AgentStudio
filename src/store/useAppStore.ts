import { create } from 'zustand';
import type { Message, AgentAction, AgentThought } from '../domain/entities/message';
import type { ChatThread } from '../domain/entities/chatThread';
import { createBlankThread, deriveThreadTitle, reviveThread } from '../domain/entities/chatThread';
import type { AppSettings } from '../domain/entities/settings';
import { reduceAgentAction, reduceAgentThoughtChunk } from '../application/services/agentStateReducers';

export type ViewId = 'tasks' | 'workspace' | 'knowledge' | 'files' | 'terminal' | 'agents' | 'settings';

interface AppState {
  projectPath: string | null;
  currentBranch: string | null;
  activeTask: string | null;
  messages: Message[];
  threads: ChatThread[];
  activeThreadId: string | null;
  activeRequestId: string | null;
  agentActions: AgentAction[];
  agentThoughts: AgentThought[];
  agentThoughtStartsNewLine: boolean;
  isAgentTyping: boolean;
  activeView: ViewId;
  settings: AppSettings;
  isSidebarOpen: boolean;
  isTerminalOpen: boolean;

  setSidebarOpen: (open: boolean) => void;
  setTerminalOpen: (open: boolean) => void;
  setProjectPath: (path: string) => void;
  setCurrentBranch: (branch: string | null) => void;
  setActiveTask: (task: string) => void;
  createThread: (title?: string) => string;
  switchThread: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
  replaceChatHistory: (threads: ChatThread[], activeThreadId?: string | null) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'> & { id?: string }) => string;
  updateMessage: (id: string, update: Partial<Message>) => void;
  appendMessageContent: (id: string, chunk: string) => void;
  clearMessages: () => void;
  replaceUserMessageAndTrim: (id: string, content: string) => Message[];
  setActiveRequestId: (requestId: string | null) => void;
  upsertAgentAction: (action: AgentAction) => void;
  clearAgentActions: () => void;
  appendAgentThoughtChunk: (requestId: string, chunk: string) => void;
  clearAgentThoughts: () => void;
  setIsAgentTyping: (typing: boolean) => void;
  setActiveView: (view: ViewId) => void;
  setSettings: (settings: Partial<AppSettings>) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  providers: [
    {
      id: 'default-openai',
      name: 'OpenAI (Default)',
      baseUrl: 'https://api.openai.com/v1',
      models: [],
      hasApiKey: false,
    }
  ],
  activeProviderId: 'default-openai',
  activeModelId: 'gpt-3.5-turbo',
  permissionMode: 'workspace-write',
  workspacePath: 'chưa có dự án',
};



function syncThread(state: AppState, messages: Message[]): Pick<AppState, 'messages' | 'threads' | 'activeTask' | 'activeThreadId'> {
  const activeThreadId = state.activeThreadId ?? crypto.randomUUID();
  const existingThread = state.threads.find((thread) => thread.id === activeThreadId);
  const title = deriveThreadTitle(messages, existingThread?.title ?? 'Chat mới');
  const updatedThread: ChatThread = {
    id: activeThreadId,
    title,
    messages,
    createdAt: existingThread?.createdAt ?? new Date(),
    updatedAt: new Date(),
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

export const useAppStore = create<AppState>()(
  (set, get) => {
    const initialThread = createBlankThread('Chat mới');

    return {
      projectPath: 'agent-desktop',
      currentBranch: null,
      activeTask: initialThread.title,
      messages: [],
      threads: [initialThread],
      activeThreadId: initialThread.id,
      activeRequestId: null,
      agentActions: [],
      agentThoughts: [],
      agentThoughtStartsNewLine: true,
      isAgentTyping: false,
      activeView: 'tasks',
      isSidebarOpen: true,
      isTerminalOpen: false,
      settings: DEFAULT_SETTINGS,

      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      setTerminalOpen: (open) => set({ isTerminalOpen: open }),
      setProjectPath: (path) => set({ projectPath: path }),
      setCurrentBranch: (branch) => set({ currentBranch: branch }),
      setActiveTask: (task) => set({ activeTask: task }),

      createThread: (title = 'Chat mới') => {
        const thread = createBlankThread(title);
        set((state) => ({
          threads: [thread, ...state.threads],
          activeThreadId: thread.id,
          messages: [],
          activeTask: thread.title,
          activeRequestId: null,
          agentActions: [],
          agentThoughts: [],
          agentThoughtStartsNewLine: true,
          isAgentTyping: false,
          activeView: 'tasks',
        }));
        return thread.id;
      },

      switchThread: (threadId) =>
        set((state) => {
          const thread = state.threads.find((item) => item.id === threadId);
          if (!thread) return {};

          return {
            activeThreadId: thread.id,
            messages: thread.messages,
            activeTask: thread.title,
            activeRequestId: null,
            agentActions: [],
            agentThoughts: [],
            agentThoughtStartsNewLine: true,
            isAgentTyping: false,
            activeView: 'tasks',
          };
        }),

      deleteThread: (threadId) =>
        set((state) => {
          const remainingThreads = state.threads.filter((thread) => thread.id !== threadId);
          const fallbackThread = remainingThreads[0] ?? createBlankThread('Chat mới');
          const threads = remainingThreads.length > 0 ? remainingThreads : [fallbackThread];
          const shouldSwitch = state.activeThreadId === threadId;

          return {
            threads,
            activeThreadId: shouldSwitch ? fallbackThread.id : state.activeThreadId,
            messages: shouldSwitch ? fallbackThread.messages : state.messages,
            activeTask: shouldSwitch ? fallbackThread.title : state.activeTask,
            agentActions: shouldSwitch ? [] : state.agentActions,
            agentThoughts: shouldSwitch ? [] : state.agentThoughts,
            agentThoughtStartsNewLine: shouldSwitch ? true : state.agentThoughtStartsNewLine,
          };
        }),

      replaceChatHistory: (threads, activeThreadId) =>
        set(() => {
          const revivedThreads = threads.length > 0
            ? threads.map(reviveThread)
            : [createBlankThread('Chat mới')];
          const activeThread = revivedThreads.find((thread) => thread.id === activeThreadId) ?? revivedThreads[0];

          return {
            threads: revivedThreads,
            activeThreadId: activeThread?.id ?? null,
            messages: activeThread?.messages ?? [],
            activeTask: activeThread?.title ?? 'Chat mới',
            activeRequestId: null,
            agentActions: [],
            agentThoughts: [],
            agentThoughtStartsNewLine: true,
            isAgentTyping: false,
            activeView: 'tasks',
          };
        }),

      addMessage: (msg) => {
        const newId = msg.id ?? crypto.randomUUID();
        const newMessage: Message = {
          ...msg,
          id: newId,
          timestamp: new Date(),
          status: msg.status ?? 'done',
        };
        set((state) => syncThread(state, [...state.messages, newMessage]));
        return newId;
      },

      updateMessage: (id, update) =>
        set((state) => syncThread(
          state,
          state.messages.map((message) => (message.id === id ? { ...message, ...update } : message)),
        )),

      appendMessageContent: (id, chunk) =>
        set((state) => syncThread(
          state,
          state.messages.map((message) =>
            message.id === id ? { ...message, content: message.content + chunk } : message
          ),
        )),

      clearMessages: () => set((state) => syncThread(state, [])),

      replaceUserMessageAndTrim: (id, content) => {
        const state = get();
        const index = state.messages.findIndex((message) => message.id === id && message.sender === 'user');
        if (index < 0) return state.messages;

        const nextMessages = state.messages.slice(0, index + 1).map((message, messageIndex) =>
          messageIndex === index ? { ...message, content, timestamp: new Date() } : message
        );
        set((currentState) => syncThread(currentState, nextMessages));
        return nextMessages;
      },

      setActiveRequestId: (requestId) => set({ activeRequestId: requestId }),
      upsertAgentAction: (action) => set((state) => {
        const { agentActions, messages } = reduceAgentAction(
          state.agentActions,
          state.messages,
          action,
        );
        return {
          agentActions,
          ...syncThread(state, messages),
        };
      }),
      clearAgentActions: () => set({ agentActions: [] }),
      appendAgentThoughtChunk: (requestId, chunk) => set((state) => {
        const next = reduceAgentThoughtChunk(
          { thoughts: state.agentThoughts, startsNewLine: state.agentThoughtStartsNewLine },
          requestId,
          chunk,
        );
        return {
          agentThoughts: next.thoughts,
          agentThoughtStartsNewLine: next.startsNewLine,
        };
      }),
      clearAgentThoughts: () => set({ agentThoughts: [], agentThoughtStartsNewLine: true }),
      setIsAgentTyping: (typing) => set({ isAgentTyping: typing }),
      setActiveView: (view) => set({ activeView: view }),
      setSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
    };
  }
);
