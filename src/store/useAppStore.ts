import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewId = 'tasks' | 'workspace' | 'knowledge' | 'files' | 'agents' | 'settings';

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

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
}

export interface AppSettings {
  providers: AIProvider[];
  activeProviderId: string | null;
  activeModelId: string | null;
}

interface AppState {
  projectPath: string | null;
  activeTask: string | null;
  messages: Message[];
  isAgentTyping: boolean;
  activeView: ViewId;
  settings: AppSettings;

  setProjectPath: (path: string) => void;
  setActiveTask: (task: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'> & { id?: string }) => string;
  updateMessage: (id: string, update: Partial<Message>) => void;
  appendMessageContent: (id: string, chunk: string) => void;
  clearMessages: () => void;
  setIsAgentTyping: (typing: boolean) => void;
  setActiveView: (view: ViewId) => void;
  setSettings: (settings: Partial<AppSettings>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      projectPath: 'agent-desktop',
      activeTask: 'Xây dựng luồng xác thực',
      messages: [],
      isAgentTyping: false,
      activeView: 'tasks',
      settings: {
        providers: [
          {
            id: 'default-openai',
            name: 'OpenAI (Default)',
            baseUrl: 'https://api.openai.com/v1',
            apiKey: '',
            models: [],
          }
        ],
        activeProviderId: 'default-openai',
        activeModelId: 'gpt-3.5-turbo',
      },

      setProjectPath: (path) => set({ projectPath: path }),
      setActiveTask: (task) => set({ activeTask: task }),

      addMessage: (msg) => {
        const newId = msg.id ?? Math.random().toString(36).substring(7);
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...msg,
              id: newId,
              timestamp: new Date(),
              status: msg.status ?? 'done',
            },
          ],
        }));
        return newId;
      },

      updateMessage: (id, update) =>
        set((state) => ({
          messages: state.messages.map((m) => (m.id === id ? { ...m, ...update } : m)),
        })),

      appendMessageContent: (id, chunk) =>
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, content: m.content + chunk } : m
          ),
        })),

      clearMessages: () => set({ messages: [] }),
      setIsAgentTyping: (typing) => set({ isAgentTyping: typing }),
      setActiveView: (view) => set({ activeView: view }),
      setSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
    }),
    {
      name: 'architect-app-settings',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
