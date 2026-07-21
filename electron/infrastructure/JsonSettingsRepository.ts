import { app, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { StoredProvider, StoredSettings } from '../domain/entities/settings.js';
import type { ISettingsRepository } from '../domain/ports/ISettingsRepository.js';
import { normalizeModelList, normalizePermissionMode } from '../application/services/providerSettings.js';
import { normalizeThemePreference } from '../application/services/themePreference.js';
import { normalizeRecentWorkspacePaths, normalizeWorkspacePath } from '../application/services/workspaceSelection.js';
import { writePrivateFileAtomic } from './storage/privateFile.js';

export type { ModelMetadata, StoredProvider, StoredSettings } from '../domain/entities/settings.js';

const DEFAULT_SETTINGS: StoredSettings = {
  providers: [],
  activeProviderId: null,
  activeModelId: null,
  fallbackModelId: null,
  permissionMode: 'workspace-write',
  workspacePath: '',
  recentWorkspacePaths: [],
  themePreference: 'system',
};

export class JsonSettingsRepository implements ISettingsRepository {
  private settingsCache: StoredSettings | null = null;
  private writeQueue = Promise.resolve();

  getSettingsPath() {
    return path.join(app.getPath('userData'), 'settings.json');
  }

  cloneDefaultSettings(): StoredSettings {
    return {
      providers: DEFAULT_SETTINGS.providers.map((provider) => ({
        ...provider,
        models: provider.models.map((model) => ({ ...model })),
      })),
      activeProviderId: DEFAULT_SETTINGS.activeProviderId,
      activeModelId: DEFAULT_SETTINGS.activeModelId,
      fallbackModelId: DEFAULT_SETTINGS.fallbackModelId,
      permissionMode: DEFAULT_SETTINGS.permissionMode,
      workspacePath: DEFAULT_SETTINGS.workspacePath,
      recentWorkspacePaths: [...(DEFAULT_SETTINGS.recentWorkspacePaths ?? [])],
      themePreference: DEFAULT_SETTINGS.themePreference,
    };
  }

  async loadStoredSettings(): Promise<StoredSettings> {
    if (this.settingsCache) return structuredClone(this.settingsCache);

    try {
      const raw = await fs.readFile(this.getSettingsPath(), 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoredSettings>;
      this.settingsCache = {
        providers: Array.isArray(parsed.providers) ? parsed.providers.map(this.normalizeStoredProvider.bind(this)) : [],
        activeProviderId: typeof parsed.activeProviderId === 'string' ? parsed.activeProviderId : null,
        activeModelId: typeof parsed.activeModelId === 'string' ? parsed.activeModelId : null,
        fallbackModelId: typeof parsed.fallbackModelId === 'string' ? parsed.fallbackModelId : null,
        permissionMode: normalizePermissionMode(parsed.permissionMode),
        workspacePath: normalizeWorkspacePath(parsed.workspacePath),
        recentWorkspacePaths: normalizeRecentWorkspacePaths([
          parsed.workspacePath,
          ...(Array.isArray(parsed.recentWorkspacePaths) ? parsed.recentWorkspacePaths : []),
        ]),
        themePreference: normalizeThemePreference(parsed.themePreference),
      };
    } catch (error) {
      if (!isMissingFile(error)) throw new Error('Persisted settings are invalid.', { cause: error });
      this.settingsCache = this.cloneDefaultSettings();
      await this.saveStoredSettings(this.settingsCache);
    }

    if (this.settingsCache.providers.length === 0) {
      this.settingsCache.activeProviderId = null;
      this.settingsCache.activeModelId = null;
      this.settingsCache.fallbackModelId = null;
    }

    return structuredClone(this.settingsCache);
  }

  async saveStoredSettings(settings: StoredSettings) {
    const next = structuredClone(settings);
    const operation = this.writeQueue.then(async () => {
      await writePrivateFileAtomic(this.getSettingsPath(), JSON.stringify(next, null, 2));
      this.settingsCache = structuredClone(next);
    });
    this.writeQueue = operation.catch(() => undefined);
    await operation;
  }

  normalizeStoredProvider(provider: Partial<StoredProvider>): StoredProvider {
    return {
      id: typeof provider.id === 'string' && provider.id ? provider.id : randomUUID(),
      name: typeof provider.name === 'string' && provider.name ? provider.name : 'Unnamed',
      baseUrl: typeof provider.baseUrl === 'string' ? provider.baseUrl : '',
      models: normalizeModelList(provider.models),
      encryptedApiKey: typeof provider.encryptedApiKey === 'string' ? provider.encryptedApiKey : undefined,
      plainApiKey: typeof provider.plainApiKey === 'string' ? provider.plainApiKey : undefined,
    };
  }

  encryptApiKey(apiKey: string): Pick<StoredProvider, 'encryptedApiKey' | 'plainApiKey'> {
    if (!apiKey) return {};
    if (safeStorage.isEncryptionAvailable()) {
      return { encryptedApiKey: safeStorage.encryptString(apiKey).toString('base64') };
    }
    console.warn('[SECURITY] safeStorage is unavailable — API key stored as plaintext. Ensure the app is running in a trusted environment.');
    return { plainApiKey: apiKey };
  }

  decryptApiKey(provider: StoredProvider): string {
    if (provider.encryptedApiKey) {
      return safeStorage.decryptString(Buffer.from(provider.encryptedApiKey, 'base64'));
    }
    return provider.plainApiKey || '';
  }
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export const settingsRepo = new JsonSettingsRepository();
