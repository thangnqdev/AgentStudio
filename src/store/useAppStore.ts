import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export type ViewId = 'tasks' | 'workspace' | 'knowledge' | 'files' | 'terminal' | 'agents' | 'settings';
export type PermissionMode = 'read-only' | 'workspace-write' | 'danger-full-access';

export interface Attachment {
  id: string;
  name: string;
  type: 'text' | 'image' | 'audio' | 'video';
  data: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  type?: 'text' | 'code' | 'permission_request';
  status?: 'sending' | 'done' | 'error';
  timestamp: Date;
  attachments?: Attachment[];
}

export interface AgentAction {
  id: string;
  requestId: string;
  toolName: string;
  args: string;
  status: 'running' | 'ok' | 'error';
  output?: string;
}

export interface AgentThought {
  id: string;
  requestId: string;
  content: string;
  timestamp: Date;
}

export interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  hasApiKey?: boolean;
}

export interface AppSettings {
  providers: AIProvider[];
  activeProviderId: string | null;
  activeModelId: string | null;
  permissionMode: PermissionMode;
  workspacePath: string;
}

interface AppState {
  projectPath: string | null;
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

  setProjectPath: (path: string) => void;
  setActiveTask: (task: string) => void;
  createThread: (title?: string) => string;
  switchThread: (threadId: string) => void;
  deleteThread: (threadId: string) => void;
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

const CHAT_HISTORY_STORAGE_KEY = 'architect-chat-history';
const PERSIST_WRITE_DELAY_MS = 750;
const MAX_PERSISTED_THREADS = 80;
const MAX_PERSISTED_MESSAGES_PER_THREAD = 120;
const MAX_PERSISTED_ATTACHMENT_BYTES = 120_000;

function createDebouncedLocalStorage(delayMs: number): StateStorage {
  const pendingValues = new Map<string, string>();
  const timers = new Map<string, number>();

  const flush = (name: string) => {
    const value = pendingValues.get(name);
    if (value === undefined) return;

    window.localStorage.setItem(name, value);
    pendingValues.delete(name);
    timers.delete(name);
  };

  window.addEventListener('beforeunload', () => {
    for (const name of pendingValues.keys()) {
      flush(name);
    }
  });

  return {
    getItem: (name) => {
      flush(name);
      return window.localStorage.getItem(name);
    },
    setItem: (name, value) => {
      pendingValues.set(name, value);
      const existingTimer = timers.get(name);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
      }
      timers.set(name, window.setTimeout(() => flush(name), delayMs));
    },
    removeItem: (name) => {
      const existingTimer = timers.get(name);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
      }
      pendingValues.delete(name);
      timers.delete(name);
      window.localStorage.removeItem(name);
    },
  };
}

function createBlankThread(title = 'Tác vụ mới'): ChatThread {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function compactAttachmentForStorage(attachment: Attachment): Attachment | null {
  if (attachment.type !== 'text') return null;
  if (attachment.data.length > MAX_PERSISTED_ATTACHMENT_BYTES) return null;
  return attachment;
}

function compactMessageForStorage(message: Message): Message {
  const attachments = message.attachments
    ?.map(compactAttachmentForStorage)
    .filter((attachment): attachment is Attachment => Boolean(attachment));

  return {
    ...message,
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
  };
}

function compactThreadForStorage(thread: ChatThread): ChatThread {
  return {
    ...thread,
    messages: thread.messages
      .slice(-MAX_PERSISTED_MESSAGES_PER_THREAD)
      .map(compactMessageForStorage),
  };
}

function deriveThreadTitle(messages: Message[], fallback = 'Tác vụ mới') {
  const firstUserMessage = messages.find((message) => message.sender === 'user' && message.content.trim());
  if (!firstUserMessage) return fallback;

  const title = firstUserMessage.content.trim().replace(/\s+/g, ' ');
  return title.length > 42 ? `${title.slice(0, 42)}...` : title;
}

function reviveMessage(message: Message): Message {
  return {
    ...message,
    timestamp: new Date(message.timestamp),
  };
}

function reviveThread(thread: ChatThread): ChatThread {
  return {
    ...thread,
    messages: Array.isArray(thread.messages) ? thread.messages.map(reviveMessage) : [],
    createdAt: new Date(thread.createdAt),
    updatedAt: new Date(thread.updatedAt),
  };
}

function syncThread(state: AppState, messages: Message[]): Pick<AppState, 'messages' | 'threads' | 'activeTask' | 'activeThreadId'> {
  const activeThreadId = state.activeThreadId ?? crypto.randomUUID();
  const existingThread = state.threads.find((thread) => thread.id === activeThreadId);
  const title = deriveThreadTitle(messages, existingThread?.title ?? 'Tác vụ mới');
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
  persist(
    (set, get) => {
      const initialThread = createBlankThread('Tác vụ mới');

      return {
        projectPath: 'agent-desktop',
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
        settings: DEFAULT_SETTINGS,

        setProjectPath: (path) => set({ projectPath: path }),
        setActiveTask: (task) => set({ activeTask: task }),

        createThread: (title = 'Tác vụ mới') => {
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
            const fallbackThread = remainingThreads[0] ?? createBlankThread('Tác vụ mới');
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
        upsertAgentAction: (action) => set((state) => ({
          agentActions: state.agentActions.some((item) => item.id === action.id)
            ? state.agentActions.map((item) => (item.id === action.id ? { ...item, ...action } : item))
            : [...state.agentActions, action],
        })),
        clearAgentActions: () => set({ agentActions: [] }),
        appendAgentThoughtChunk: (requestId, chunk) => set((state) => {
          const normalizedChunk = chunk.replace(/\r\n/g, '\n');
          if (!normalizedChunk) return {};

          const thoughts = [...state.agentThoughts];
          const segments = normalizedChunk.split('\n');
          let startsNewLine = state.agentThoughtStartsNewLine;

          segments.forEach((segment, index) => {
            const shouldAppend = !startsNewLine
              && segment
              && thoughts.length > 0
              && thoughts[thoughts.length - 1].requestId === requestId;

            if (shouldAppend) {
              const lastThought = thoughts[thoughts.length - 1];
              thoughts[thoughts.length - 1] = {
                ...lastThought,
                content: `${lastThought.content}${segment}`,
                timestamp: new Date(),
              };
            } else if (segment.trim()) {
              thoughts.push({
                id: crypto.randomUUID(),
                requestId,
                content: segment,
                timestamp: new Date(),
              });
            }

            if (segment) {
              startsNewLine = false;
            }
            if (index < segments.length - 1) {
              startsNewLine = true;
            }
          });

          return {
            agentThoughts: thoughts
              .filter((thought) => thought.content.trim())
              .slice(-120),
            agentThoughtStartsNewLine: startsNewLine,
          };
        }),
        clearAgentThoughts: () => set({ agentThoughts: [], agentThoughtStartsNewLine: true }),
        setIsAgentTyping: (typing) => set({ isAgentTyping: typing }),
        setActiveView: (view) => set({ activeView: view }),
        setSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      };
    },
    {
      name: CHAT_HISTORY_STORAGE_KEY,
      storage: createJSONStorage(() => createDebouncedLocalStorage(PERSIST_WRITE_DELAY_MS)),
      partialize: (state) => ({
        threads: state.threads.slice(0, MAX_PERSISTED_THREADS).map(compactThreadForStorage),
        activeThreadId: state.activeThreadId,
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<AppState>;
        const threads = Array.isArray(persistedState.threads)
          ? persistedState.threads.map(reviveThread)
          : current.threads;
        const activeThread = threads.find((thread) => thread.id === persistedState.activeThreadId) ?? threads[0];

        return {
          ...current,
          threads,
          activeThreadId: activeThread?.id ?? null,
          messages: activeThread?.messages ?? [],
          activeTask: activeThread?.title ?? current.activeTask,
          settings: current.settings,
        };
      },
    }
  )
);
