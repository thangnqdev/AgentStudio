import type { PermissionMode } from './agent.js';
import type { ThemePreference } from './theme.js';

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
  themePreference: ThemePreference;
}

export interface SaveProviderInput {
  id?: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  models?: unknown;
}

export type LegacyProviderInput = SaveProviderInput;

export interface LegacySettingsInput {
  providers: LegacyProviderInput[];
  activeProviderId?: string | null;
  activeModelId?: string | null;
  fallbackModelId?: string | null;
  permissionMode?: PermissionMode;
}
