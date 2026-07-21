import type { StateCreator } from 'zustand';
import type { ResumableTask } from '../domain/entities/agentTask';
import type { ChatThread } from '../domain/entities/chatThread';
import type { AgentAction, AgentThought, Message } from '../domain/entities/message';
import type { AppSettings } from '../domain/entities/settings';
import type { PendingAgentInteraction } from '../domain/entities/agentInteraction';
import type { AgentWorktreeState } from '../domain/entities/agentWorktree';
import type { WorkspaceSurface } from '../domain/entities/workspaceSurface';
import type { OpenUtilityDockTabInput, UtilityDockTab } from '../domain/entities/utilityDock';

export type ViewId = WorkspaceSurface;

export interface UiSlice {
  projectPath: string | null;
  currentBranch: string | null;
  activeView: ViewId | null;
  isSidebarOpen: boolean;
  sidebarWidth: number;
  isUtilityDockOpen: boolean;
  utilityDockWidth: number;
  utilityDockTabs: UtilityDockTab[];
  activeUtilityDockTabId: string;
  pendingWorkspaceThreadId: string | null;
  setProjectPath: (path: string) => void;
  setCurrentBranch: (branch: string | null) => void;
  setActiveView: (view: ViewId) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setUtilityDockOpen: (open: boolean) => void;
  toggleUtilityDock: () => void;
  setUtilityDockWidth: (width: number) => void;
  openUtilityDockTab: (input: OpenUtilityDockTabInput) => string;
  activateUtilityDockTab: (tabId: string) => void;
  closeUtilityDockTab: (tabId: string) => string;
  requestWorkspaceThread: (threadId: string | null) => void;
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
  renameActiveThread: (title: string) => void;
  replaceChatHistory: (threads: ChatThread[], activeThreadId?: string | null) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'> & { id?: string }) => string;
  updateMessage: (id: string, update: Partial<Message>) => void;
  appendMessageContent: (id: string, chunk: string) => void;
  clearMessages: () => void;
  replaceMessages: (messages: Message[]) => void;
  replaceUserMessageAndTrim: (id: string, content: string) => Message[];
}

export interface AgentSlice {
  activeRequestId: string | null;
  agentActions: AgentAction[];
  agentThoughts: AgentThought[];
  agentThoughtStartsNewLine: boolean;
  isAgentTyping: boolean;
  resumableTask: ResumableTask | null;
  pendingInteraction: PendingAgentInteraction | null;
  planModeActive: boolean;
  worktreeState: AgentWorktreeState;
  setActiveRequestId: (requestId: string | null) => void;
  upsertAgentAction: (action: AgentAction) => void;
  clearAgentActions: () => void;
  appendAgentThoughtChunk: (requestId: string, chunk: string) => void;
  clearAgentThoughts: () => void;
  setIsAgentTyping: (typing: boolean) => void;
  setResumableTask: (task: ResumableTask | null) => void;
  setPendingInteraction: (interaction: PendingAgentInteraction | null) => void;
  setPlanModeActive: (active: boolean) => void;
  setWorktreeState: (worktree: AgentWorktreeState) => void;
}

export interface SettingsSlice {
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;
}

export type AppState = UiSlice & ChatSlice & AgentSlice & SettingsSlice;
export type AppSlice<TSlice> = StateCreator<AppState, [], [], TSlice>;
