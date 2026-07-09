import { create } from 'zustand';

export type ViewId = 'tasks' | 'workspace' | 'knowledge' | 'files' | 'agents';

export interface Message {
  id: string;
  sender: 'user' | 'agent';
  content: string;
  type?: 'text' | 'code' | 'permission_request';
  status?: 'sending' | 'done' | 'error';
  timestamp: Date;
}

interface AppState {
  projectPath: string | null;
  activeTask: string | null;
  messages: Message[];
  isAgentTyping: boolean;
  activeView: ViewId;

  setProjectPath: (path: string) => void;
  setActiveTask: (task: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setIsAgentTyping: (typing: boolean) => void;
  setActiveView: (view: ViewId) => void;
}

export const useAppStore = create<AppState>((set) => ({
  projectPath: 'agent-desktop',
  activeTask: 'Build authentication flow',
  messages: [],
  isAgentTyping: false,
  activeView: 'tasks',

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
}));
