import type { AppSettings, Message, PermissionMode } from '../store/useAppStore';

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
    models?: string[];
  }>;
  activeProviderId?: string | null;
  activeModelId?: string | null;
  permissionMode?: PermissionMode;
};

type ChatEventPayload = {
  requestId: string;
  chunk?: string;
  error?: string;
};

type ChatEventListener = (payload: ChatEventPayload) => void;

type WriteWorkspaceFilePayload = {
  path: string;
  content: string;
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
      writeWorkspaceFile: (payload: WriteWorkspaceFilePayload) => Promise<{ ok: boolean; path: string }>;
      startChat: (payload: { requestId: string; messages: Message[] }) => void;
      stopChat: (requestId: string) => void;
      onChatChunk: (listener: ChatEventListener) => () => void;
      onChatDone: (listener: ChatEventListener) => () => void;
      onChatError: (listener: ChatEventListener) => () => void;
    };
  }
}

export {};
