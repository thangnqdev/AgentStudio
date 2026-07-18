import { app, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { RemoteTriggerSettings } from '../../domain/entities/remoteTrigger.js';
import { normalizeRemoteTriggerBaseUrl, normalizeRemoteTriggerToken } from '../../domain/entities/remoteTrigger.js';
import type { IRemoteTriggerSettingsRepository } from '../../domain/ports/IRemoteTriggerSettingsRepository.js';
import { writePrivateFileAtomic } from '../storage/privateFile.js';

const VERSION = 1;
type StoredSettings = {
  version: typeof VERSION;
  enabled: boolean;
  baseUrl?: string;
  encryptedBearerToken?: string;
  plainBearerToken?: string;
};

export class EncryptedRemoteTriggerSettingsRepository implements IRemoteTriggerSettingsRepository {
  private readonly filePath: string | (() => string);
  private writeQueue = Promise.resolve();

  constructor(filePath: string | (() => string) = () => path.join(app.getPath('userData'), 'remote-trigger.json')) {
    this.filePath = filePath;
  }

  async load(): Promise<RemoteTriggerSettings> {
    try {
      const target = this.target();
      const stat = await fs.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 100_000) throw new Error('RemoteTrigger settings file is unsafe.');
      const parsed = JSON.parse(await fs.readFile(target, 'utf8')) as unknown;
      if (!isStoredSettings(parsed)) throw new Error('RemoteTrigger settings are invalid.');
      const bearerToken = normalizeRemoteTriggerToken(this.decryptToken(parsed));
      const baseUrl = normalizeRemoteTriggerBaseUrl(parsed.baseUrl);
      return {
        enabled: parsed.enabled,
        ...(baseUrl ? { baseUrl } : {}),
        ...(bearerToken ? { bearerToken } : {}),
      };
    } catch (error) {
      if (isMissing(error)) return { enabled: false };
      throw error;
    }
  }

  async save(settings: RemoteTriggerSettings) {
    const stored: StoredSettings = {
      version: VERSION, enabled: settings.enabled,
      ...(settings.baseUrl ? { baseUrl: settings.baseUrl } : {}),
      ...this.encryptToken(settings.bearerToken),
    };
    const operation = this.writeQueue.then(() => writePrivateFileAtomic(this.target(), JSON.stringify(stored, null, 2)));
    this.writeQueue = operation.catch(() => undefined);
    await operation;
  }

  private target() { return path.resolve(typeof this.filePath === 'function' ? this.filePath() : this.filePath); }

  private encryptToken(token: string | undefined): Pick<StoredSettings, 'encryptedBearerToken' | 'plainBearerToken'> {
    if (!token) return {};
    if (safeStorage.isEncryptionAvailable()) {
      return { encryptedBearerToken: safeStorage.encryptString(token).toString('base64') };
    }
    console.warn('[SECURITY] safeStorage is unavailable — RemoteTrigger token stored as plaintext.');
    return { plainBearerToken: token };
  }

  private decryptToken(settings: StoredSettings) {
    if (settings.encryptedBearerToken) {
      return safeStorage.decryptString(Buffer.from(settings.encryptedBearerToken, 'base64'));
    }
    return settings.plainBearerToken;
  }
}

function isStoredSettings(value: unknown): value is StoredSettings {
  return isObject(value) && value.version === VERSION && typeof value.enabled === 'boolean'
    && optionalString(value.baseUrl, 2_048) && optionalString(value.encryptedBearerToken, 20_000)
    && optionalString(value.plainBearerToken, 8_192);
}
function optionalString(value: unknown, maximum: number) { return value === undefined || typeof value === 'string' && value.length <= maximum; }
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function isMissing(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
