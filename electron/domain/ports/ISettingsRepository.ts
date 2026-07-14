import type {
  ProtectedApiKey,
  StoredProvider,
  StoredSettings,
} from '../entities/settings.js';

export interface ISettingsRepository {
  loadStoredSettings(): Promise<StoredSettings>;
  saveStoredSettings(settings: StoredSettings): Promise<void>;
  encryptApiKey(apiKey: string): ProtectedApiKey;
  decryptApiKey(provider: StoredProvider): string;
}
