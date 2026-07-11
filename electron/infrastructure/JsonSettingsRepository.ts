import { app, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PermissionMode } from '../domain/entities/agent.js';

export type ModelMetadata = {
  id: string;
  contextWindow?: number;
};

export type StoredProvider = {
  id: string;
  name: string;
  baseUrl: string;
  models: ModelMetadata[];
  encryptedApiKey?: string;
  plainApiKey?: string;
};

export type StoredSettings = {
  providers: StoredProvider[];
  activeProviderId: string | null;
  activeModelId: string | null;
  permissionMode: PermissionMode;
  workspacePath: string;
};

const DEFAULT_SETTINGS: StoredSettings = {
  providers: [],
  activeProviderId: null,
  activeModelId: null,
  permissionMode: 'workspace-write',
  workspacePath: process.cwd(),
};

export class JsonSettingsRepository {
  private settingsCache: StoredSettings | null = null;

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
      permissionMode: DEFAULT_SETTINGS.permissionMode,
      workspacePath: DEFAULT_SETTINGS.workspacePath,
    };
  }

  async loadStoredSettings(): Promise<StoredSettings> {
    if (this.settingsCache) return this.settingsCache;

    try {
      const raw = await fs.readFile(this.getSettingsPath(), 'utf8');
      const parsed = JSON.parse(raw) as Partial<StoredSettings>;
      this.settingsCache = {
        providers: Array.isArray(parsed.providers) ? parsed.providers.map(this.normalizeStoredProvider.bind(this)) : [],
        activeProviderId: typeof parsed.activeProviderId === 'string' ? parsed.activeProviderId : null,
        activeModelId: typeof parsed.activeModelId === 'string' ? parsed.activeModelId : null,
        permissionMode: this.normalizePermissionMode(parsed.permissionMode),
        workspacePath: typeof parsed.workspacePath === 'string' && parsed.workspacePath ? parsed.workspacePath : process.cwd(),
      };
    } catch {
      this.settingsCache = this.cloneDefaultSettings();
      await this.saveStoredSettings(this.settingsCache);
    }

    if (this.settingsCache.providers.length === 0) {
      this.settingsCache.activeProviderId = null;
      this.settingsCache.activeModelId = null;
    }

    return this.settingsCache;
  }

  async saveStoredSettings(settings: StoredSettings) {
    this.settingsCache = settings;
    await fs.mkdir(path.dirname(this.getSettingsPath()), { recursive: true });
    await fs.writeFile(this.getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
  }

  normalizeStoredProvider(provider: Partial<StoredProvider>): StoredProvider {
    return {
      id: typeof provider.id === 'string' && provider.id ? provider.id : randomUUID(),
      name: typeof provider.name === 'string' && provider.name ? provider.name : 'Unnamed',
      baseUrl: typeof provider.baseUrl === 'string' ? provider.baseUrl : '',
      models: this.normalizeModelList(provider.models),
      encryptedApiKey: typeof provider.encryptedApiKey === 'string' ? provider.encryptedApiKey : undefined,
      plainApiKey: typeof provider.plainApiKey === 'string' ? provider.plainApiKey : undefined,
    };
  }

  normalizePermissionMode(value: unknown): PermissionMode {
    if (value === 'read-only' || value === 'workspace-write' || value === 'danger-full-access') {
      return value;
    }
    return 'workspace-write';
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

  normalizeModelList(value: unknown): ModelMetadata[] {
    if (!Array.isArray(value)) return [];

    const models: ModelMetadata[] = [];
    const seen = new Set<string>();
    for (const item of value) {
      const model = this.readModelMetadata(item);
      if (!model || seen.has(model.id)) continue;
      seen.add(model.id);
      models.push(model);
    }
    return models;
  }

  readModelMetadata(value: unknown): ModelMetadata | null {
    if (typeof value === 'string') return { id: value };
    if (!this.isObject(value)) return null;

    const id = value.id;
    const name = value.name;
    const modelId = typeof id === 'string' && id ? id : typeof name === 'string' && name ? name : '';
    if (!modelId) return null;

    const contextWindow = this.readContextWindow(value);
    return contextWindow ? { id: modelId, contextWindow } : { id: modelId };
  }

  isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  readContextWindow(value: Record<string, unknown>): number | undefined {
    const fieldNames = [
      'contextWindow', 'context_window', 'contextLength', 'context_length',
      'maxContextLength', 'max_context_length', 'maxContextWindow', 'max_context_window',
      'maxModelLen', 'max_model_len', 'maxPositionEmbeddings', 'max_position_embeddings',
      'n_ctx', 'num_ctx', 'context', 'context_size', 'token_limit',
    ];

    for (const fieldName of fieldNames) {
      const parsed = this.normalizeContextWindow(value[fieldName]);
      if (parsed) return parsed;
    }

    for (const fieldName of ['metadata', 'details', 'info', 'parameters', 'config', 'top_provider', 'context']) {
      const nested = value[fieldName];
      if (!this.isObject(nested)) continue;
      const parsed = this.readContextWindow(nested);
      if (parsed) return parsed;
    }

    return undefined;
  }

  normalizeContextWindow(value: unknown): number | undefined {
    const numericValue = typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.replace(/,/g, ''))
        : Number.NaN;
    if (!Number.isFinite(numericValue) || numericValue <= 0) return undefined;
    return Math.floor(numericValue);
  }
}

export const settingsRepo = new JsonSettingsRepository();
