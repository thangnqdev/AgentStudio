import type { StateCreator } from 'zustand';
import type { ResumableTask } from '../domain/entities/agentTask';
import type { ChatThread } from '../domain/entities/chatThread';
import type { AgentAction, AgentThought, Message } from '../domain/entities/message';
import type { AppSettings } from '../domain/entities/settings';

export type ViewId = 'tasks' | 'workspace' | 'knowledge' | 'observability' | 'evaluations' | 'workflows' | 'capabilities' | 'optimizer' | 'skill-learning' | 'files' | 'terminal' | 'agents' | 'settings';

export interface UiSlice {
  projectPath: string | null;
  currentBranch: string | null;
  activeView: ViewId;
  isSidebarOpen: boolean;
  isTerminalOpen: boolean;
  setProjectPath: (path: string) => void;
  setCurrentBranch: (branch: string | null) => void;
  setActiveView: (view: ViewId) => void;
  setSidebarOpen: (open: boolean) => void;
  setTerminalOpen: (open: boolean) => void;
}

export interface ChatSlice {
  activeTask: string | null;
  messages: Message[];
  threads: ChatThread[];
  activeThreadId: string | null;
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
}

export interface AgentSlice {
  activeRequestId: string | null;
  agentActions: AgentAction[];
  agentThoughts: AgentThought[];
  agentThoughtStartsNewLine: boolean;
  isAgentTyping: boolean;
  resumableTask: ResumableTask | null;
  setActiveRequestId: (requestId: string | null) => void;
  upsertAgentAction: (action: AgentAction) => void;
  clearAgentActions: () => void;
  appendAgentThoughtChunk: (requestId: string, chunk: string) => void;
  clearAgentThoughts: () => void;
  setIsAgentTyping: (typing: boolean) => void;
  setResumableTask: (task: ResumableTask | null) => void;
}

export interface SettingsSlice {
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;
}

export type AppState = UiSlice & ChatSlice & AgentSlice & SettingsSlice;
export type AppSlice<TSlice> = StateCreator<AppState, [], [], TSlice>;
