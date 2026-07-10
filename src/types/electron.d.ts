import type { AIModel, AppSettings, ChatThread, Message, PermissionMode } from '../store/useAppStore';

type SaveProviderPayload = {
  id?: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
};

type LegacySettingsPayload = {
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

type ChatEventPayload = {
  requestId: string;
  chunk?: string;
  error?: string;
  action?: ChatActionPayload;
};

type ChatActionPayload = {
  id: string;
  toolName: string;
  args: string;
  status: 'running' | 'ok' | 'error';
  output?: string;
};

type ChatEventListener = (payload: ChatEventPayload) => void;

type TerminalCreatePayload = {
  cols: number;
  rows: number;
  shellId?: string;
};

type TerminalCreatedPayload = {
  terminalId: string;
  shellId: string;
  shell: string;
  shellLabel: string;
  cwd: string;
};

type CommandShellPayload = {
  id: string;
  label: string;
  command: string;
};

type TerminalEventPayload = {
  terminalId: string;
  data?: string;
  exitCode?: number;
  signal?: number | string;
};

type TerminalEventListener = (payload: TerminalEventPayload) => void;

type WriteWorkspaceFilePayload = {
  path: string;
  content: string;
};

type WorkspacePayload = {
  path: string;
  canceled?: boolean;
};

type ChatHistoryPayload = {
  threads: ChatThread[];
  activeThreadId: string | null;
};

declare global {
  interface Window {
    agentStudio?: {
      ping: () => Promise<string>;
      loadSettings: () => Promise<AppSettings>;
      importLegacySettings: (settings: LegacySettingsPayload) => Promise<AppSettings>;
      saveProviderAndScan: (provider: SaveProviderPayload) => Promise<AppSettings>;
      deleteProvider: (providerId: string) => Promise<AppSettings>;
      setActiveProvider: (providerId: string) => Promise<AppSettings>;
      setActiveModel: (modelId: string) => Promise<AppSettings>;
      setPermissionMode: (mode: PermissionMode) => Promise<AppSettings>;
      getCurrentWorkspace: () => Promise<WorkspacePayload>;
      selectWorkspace: () => Promise<WorkspacePayload>;
      writeWorkspaceFile: (payload: WriteWorkspaceFilePayload) => Promise<{ ok: boolean; path: string }>;
      getFilePath: (file: File) => string;
      loadChatHistory: (workspacePath: string) => Promise<ChatHistoryPayload>;
      saveChatHistory: (payload: { workspacePath: string; threads: ChatThread[]; activeThreadId: string | null }) => Promise<{ ok: boolean }>;
      startChat: (payload: { requestId: string; messages: Message[] }) => void;
      stopChat: (requestId: string) => void;
      onChatChunk: (listener: ChatEventListener) => () => void;
      onChatAction: (listener: ChatEventListener) => () => void;
      onChatDone: (listener: ChatEventListener) => () => void;
      onChatError: (listener: ChatEventListener) => () => void;
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
