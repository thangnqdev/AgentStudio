import type { PermissionMode } from './agent.js';

export interface ModelMetadata {
  id: string;
  contextWindow?: number;
}

export interface ProtectedApiKey {
  encryptedApiKey?: string;
  plainApiKey?: string;
}

export interface StoredProvider extends ProtectedApiKey {
  id: string;
  name: string;
  baseUrl: string;
  models: ModelMetadata[];
}

export interface StoredSettings {
  providers: StoredProvider[];
  activeProviderId: string | null;
  activeModelId: string | null;
  fallbackModelId: string | null;
  permissionMode: PermissionMode;
  workspacePath: string;
}

export interface SaveProviderInput {
  id?: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
}

export interface LegacyProviderInput extends SaveProviderInput {
  models?: unknown;
}

export interface LegacySettingsInput {
  providers: LegacyProviderInput[];
  activeProviderId?: string | null;
  activeModelId?: string | null;
  fallbackModelId?: string | null;
  permissionMode?: PermissionMode;
}
