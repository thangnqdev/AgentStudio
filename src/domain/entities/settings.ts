export type PermissionMode = 'read-only' | 'workspace-write' | 'danger-full-access';

export interface AIModel {
  id: string;
  contextWindow?: number;
}

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: AIModel[];
  hasApiKey?: boolean;
}

export interface AppSettings {
  providers: AIProvider[];
  activeProviderId: string | null;
  activeModelId: string | null;
  fallbackModelId: string | null;
  permissionMode: PermissionMode;
  workspacePath: string;
}
