import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewId = 'tasks' | 'workspace' | 'knowledge' | 'files' | 'agents' | 'settings';

export interface Message {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  type?: 'text' | 'code' | 'permission_request';
  status?: 'sending' | 'done' | 'error';
  timestamp: Date;
}

export interface AppSettings {
  baseUrl: string;
  apiKey: string;
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
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setIsAgentTyping: (typing: boolean) => void;
  setActiveView: (view: ViewId) => void;
  setSettings: (settings: Partial<AppSettings>) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      projectPath: 'agent-desktop',
      activeTask: 'Build authentication flow',
      messages: [],
      isAgentTyping: false,
      activeView: 'tasks',
      settings: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
      },

      setProjectPath: (path) => set({ projectPath: path }),
      setActiveTask: (task) => set({ activeTask: task }),

      addMessage: (msg) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...msg,
              id: Math.random().toString(36).substring(7),
              timestamp: new Date(),
              status: msg.status ?? 'done',
            },
          ],
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
