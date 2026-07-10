import { app, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { PublicWebSearchSettings, WebSearchProvider, WebSearchSettings } from '../domain/entities/webSearch.js';

type StoredWebSearchSettings = Omit<WebSearchSettings, 'apiKey'> & { encryptedApiKey?: string; plainApiKey?: string };

const DEFAULT_SETTINGS: StoredWebSearchSettings = { provider: 'disabled' };

export class WebSearchSettingsRepository {
  getPath() {
    return path.join(app.getPath('userData'), 'web-search-settings.json');
  }

  async load(): Promise<WebSearchSettings> {
    const stored = await this.loadStored();
    return { provider: stored.provider, baseUrl: stored.baseUrl, model: stored.model, apiKey: this.decrypt(stored) };
  }

  async loadPublic(): Promise<PublicWebSearchSettings> {
    const stored = await this.loadStored();
    return { provider: stored.provider, baseUrl: stored.baseUrl, model: stored.model, hasApiKey: Boolean(stored.encryptedApiKey || stored.plainApiKey) };
  }

  async save(input: WebSearchSettings): Promise<PublicWebSearchSettings> {
    const current = await this.loadStored();
    const stored: StoredWebSearchSettings = {
      provider: normalizeProvider(input.provider),
      baseUrl: normalizeUrl(input.baseUrl),
      model: typeof input.model === 'string' ? input.model.trim().slice(0, 120) || undefined : undefined,
      ...(input.apiKey ? this.encrypt(input.apiKey) : input.provider === current.provider
        ? { encryptedApiKey: current.encryptedApiKey, plainApiKey: current.plainApiKey }
        : {}),
    };
    if (stored.provider === 'disabled' || stored.provider === 'searxng') {
      delete stored.encryptedApiKey;
      delete stored.plainApiKey;
    }
    await fs.mkdir(path.dirname(this.getPath()), { recursive: true });
    await fs.writeFile(this.getPath(), JSON.stringify(stored, null, 2), 'utf8');
    return { provider: stored.provider, baseUrl: stored.baseUrl, model: stored.model, hasApiKey: Boolean(stored.encryptedApiKey || stored.plainApiKey) };
  }

  private async loadStored(): Promise<StoredWebSearchSettings> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.getPath(), 'utf8')) as Partial<StoredWebSearchSettings>;
      return {
        provider: normalizeProvider(parsed.provider),
        baseUrl: normalizeUrl(parsed.baseUrl),
        model: typeof parsed.model === 'string' ? parsed.model : undefined,
        encryptedApiKey: typeof parsed.encryptedApiKey === 'string' ? parsed.encryptedApiKey : undefined,
        plainApiKey: typeof parsed.plainApiKey === 'string' ? parsed.plainApiKey : undefined,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private encrypt(apiKey: string) {
    return safeStorage.isEncryptionAvailable()
      ? { encryptedApiKey: safeStorage.encryptString(apiKey).toString('base64') }
      : { plainApiKey: apiKey };
  }

  private decrypt(settings: StoredWebSearchSettings) {
    return settings.encryptedApiKey ? safeStorage.decryptString(Buffer.from(settings.encryptedApiKey, 'base64')) : settings.plainApiKey || '';
  }
}

function normalizeProvider(value: unknown): WebSearchProvider {
  return value === 'openai' || value === 'tavily' || value === 'searxng' ? value : 'disabled';
}

function normalizeUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const url = new URL(value.trim());
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Web search URL must use HTTP or HTTPS.');
  return url.toString().replace(/\/$/, '');
}

export const webSearchSettingsRepository = new WebSearchSettingsRepository();
