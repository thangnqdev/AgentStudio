import type { Message } from '../domain/entities/message';
import type { ChatThread } from '../domain/entities/chatThread';
import type { AIModel, AppSettings, PermissionMode } from '../domain/entities/settings';
import type { KnowledgeDocument } from '../domain/entities/knowledge';

export type SaveProviderPayload = {
  id?: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
};

export type LegacySettingsPayload = {
  providers?: Array<{
    id?: string;
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    models?: Array<string | AIModel>;
  }>;
  activeProviderId?: string | null;
  activeModelId?: string | null;
  permissionMode?: PermissionMode;
};

export type ChatEventPayload = {
  requestId: string;
  chunk?: string;
  error?: string;
  action?: ChatActionPayload;
  task?: ChatTaskStatusPayload;
};

export type ChatActionPayload = {
  id: string;
  toolName: string;
  args: string;
  risk: 'read' | 'write' | 'execute' | 'network';
  status: 'awaiting_approval' | 'denied' | 'running' | 'ok' | 'error';
  output?: string;
};

export type ChatTaskStatusPayload = {
  taskId: string;
  status: 'paused' | 'completed';
  completedSteps: number;
};

export type ChatEventListener = (payload: ChatEventPayload) => void;

export type TerminalCreatePayload = {
  cols: number;
  rows: number;
  shellId?: string;
};

export type TerminalCreatedPayload = {
  terminalId: string;
  shellId: string;
  shell: string;
  shellLabel: string;
  cwd: string;
};

export type CommandShellPayload = {
  id: string;
  label: string;
  command: string;
};

export type TerminalEventPayload = {
  terminalId: string;
  data?: string;
  exitCode?: number;
  signal?: number | string;
};

export type TerminalEventListener = (payload: TerminalEventPayload) => void;

export type WriteWorkspaceFilePayload = {
  path: string;
  content: string;
};

export type WorkspacePayload = {
  path: string;
  canceled?: boolean;
};

export type ChatHistoryPayload = {
  threads: ChatThread[];
  activeThreadId: string | null;
};

export type AgentTaskSummary = {
  id: string;
  title: string;
  workspaceRoot: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  completedSteps: number;
  lastError?: string;
};

export type AgentTaskListResult =
  | { success: true; tasks: AgentTaskSummary[] }
  | { success: false; error: string };

export type WebSearchProvider = 'disabled' | 'openai' | 'tavily' | 'searxng';

export type PublicWebSearchSettings = {
  provider: WebSearchProvider;
  baseUrl?: string;
  model?: string;
  hasApiKey: boolean;
};

export type WebSearchSettingsResult =
  | { success: true; settings: PublicWebSearchSettings }
  | { success: false; error: string };

export type KnowledgeLibraryPayload = {
  documents: KnowledgeDocument[];
  totalChunks: number;
  semanticReady: boolean;
  watching: boolean;
};

export type KnowledgeImportPayload = {
  canceled: boolean;
  imported: KnowledgeDocument[];
  warnings: string[];
};

export type KnowledgeWorkspaceSyncPayload = KnowledgeImportPayload & {
  scanned: number;
  truncated: boolean;
  watching: boolean;
};

export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

declare global {
  interface Window {
    agentStudio?: {
      ping: () => Promise<string>;
      getPlatform: () => string;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      loadSettings: () => Promise<AppSettings>;
      importLegacySettings: (settings: LegacySettingsPayload) => Promise<AppSettings>;
      saveProviderAndScan: (provider: SaveProviderPayload) => Promise<AppSettings>;
      deleteProvider: (providerId: string) => Promise<AppSettings>;
      setActiveProvider: (providerId: string) => Promise<AppSettings>;
      setActiveModel: (modelId: string) => Promise<AppSettings>;
      setPermissionMode: (mode: PermissionMode) => Promise<AppSettings>;
      loadWebSearchSettings: () => Promise<WebSearchSettingsResult>;
      saveWebSearchSettings: (payload: { provider: WebSearchProvider; baseUrl?: string; apiKey?: string; model?: string }) => Promise<WebSearchSettingsResult>;
      getCurrentWorkspace: () => Promise<WorkspacePayload>;
      selectWorkspace: () => Promise<WorkspacePayload>;
      writeWorkspaceFile: (payload: WriteWorkspaceFilePayload) => Promise<{ success: true; path: string } | { success: false; error: string }>;
      getFilePath: (file: File) => string;
      loadChatHistory: (workspacePath: string) => Promise<ChatHistoryPayload>;
      saveChatHistory: (payload: { workspacePath: string; threads: ChatThread[]; activeThreadId: string | null }) => Promise<{ ok: boolean }>;
      getGitBranch: (workspacePath: string) => Promise<string | null>;
      listKnowledge: () => Promise<IpcResult<KnowledgeLibraryPayload>>;
      selectAndImportKnowledge: () => Promise<IpcResult<KnowledgeImportPayload>>;
      syncWorkspaceKnowledge: () => Promise<IpcResult<KnowledgeWorkspaceSyncPayload>>;
      stopWorkspaceKnowledgeSync: () => Promise<IpcResult<{ watching: boolean }>>;
      removeKnowledgeDocument: (documentId: string) => Promise<IpcResult<{ ok: boolean }>>;
      startChat: (payload: { requestId: string; taskId?: string; messages: Message[] }) => void;
      stopChat: (requestId: string) => void;
      respondToToolApproval: (payload: { requestId: string; actionId: string; approved: boolean }) => void;
      onChatChunk: (listener: ChatEventListener) => () => void;
      onChatAction: (listener: ChatEventListener) => () => void;
      onChatDone: (listener: ChatEventListener) => () => void;
      onChatError: (listener: ChatEventListener) => () => void;
      onChatTaskStatus: (listener: ChatEventListener) => () => void;
      listResumableAgentTasks: () => Promise<AgentTaskListResult>;
      listCommandShells: () => Promise<CommandShellPayload[]>;
      createTerminal: (payload: TerminalCreatePayload) => Promise<TerminalCreatedPayload>;
      writeTerminal: (payload: { terminalId: string; data: string }) => void;
      resizeTerminal: (payload: { terminalId: string; cols: number; rows: number }) => void;
      killTerminal: (terminalId: string) => void;
      onTerminalData: (listener: TerminalEventListener) => () => void;
      onTerminalExit: (listener: TerminalEventListener) => () => void;
    };
  }
}

export {};
