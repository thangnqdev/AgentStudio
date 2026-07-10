import { ipcMain } from 'electron';
import { settingsRepo, type StoredSettings, type StoredProvider, type ModelMetadata } from '../infrastructure/JsonSettingsRepository.js';
import { randomUUID } from 'node:crypto';
import type { PermissionMode } from '../agentRuntime.js';

type SaveProviderPayload = {
  id?: string;
  name?: string;
  baseUrl?: string;
  apiKey?: string;
};

type LegacySettingsPayload = {
  providers?: Array<SaveProviderPayload & { models?: unknown[] }>;
  activeProviderId?: string | null;
  activeModelId?: string | null;
  permissionMode?: PermissionMode;
};

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new Error('Base URL không được để trống.');
  }

  const withProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withProtocol);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Base URL chỉ hỗ trợ HTTP hoặc HTTPS.');
  }

  return url.toString().replace(/\/$/, '');
}

function buildEndpoint(baseUrl: string, endpoint: string) {
  return new URL(endpoint, `${baseUrl.replace(/\/$/, '')}/`).toString();
}

async function fetchAvailableModels(baseUrl: string, apiKey: string): Promise<ModelMetadata[]> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(buildEndpoint(baseUrl, 'models'), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (settingsRepo.isObject(data) && Array.isArray(data.data)) {
    return settingsRepo.normalizeModelList(data.data);
  }

  if (settingsRepo.isObject(data) && Array.isArray(data.models)) {
    return settingsRepo.normalizeModelList(data.models);
  }

  if (Array.isArray(data)) {
    return settingsRepo.normalizeModelList(data);
  }

  throw new Error('Định dạng danh sách model không hợp lệ từ server.');
}

function toPublicSettings(settings: StoredSettings) {
  return {
    providers: settings.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl,
      models: provider.models.map((model) => ({ ...model })),
      hasApiKey: Boolean(provider.encryptedApiKey || provider.plainApiKey),
    })),
    activeProviderId: settings.activeProviderId,
    activeModelId: settings.activeModelId,
    permissionMode: settings.permissionMode,
    workspacePath: settings.workspacePath,
  };
}

function hasModel(provider: StoredProvider | null | undefined, modelId: string | null | undefined) {
  return Boolean(provider && modelId && provider.models.some((model) => model.id === modelId));
}

function firstModelId(provider: StoredProvider | null | undefined) {
  return provider?.models[0]?.id ?? null;
}

export function registerSettingsIpc() {
  ipcMain.handle('settings:load', async () => {
    return toPublicSettings(await settingsRepo.loadStoredSettings());
  });

  ipcMain.handle('settings:import-legacy', async (_event, rawPayload: LegacySettingsPayload) => {
    if (!settingsRepo.isObject(rawPayload) || !Array.isArray(rawPayload.providers)) {
      return toPublicSettings(await settingsRepo.loadStoredSettings());
    }

    const providers = rawPayload.providers.map((provider) => {
      const baseUrl = getString(provider.baseUrl).trim();
      const apiKey = getString(provider.apiKey);

      return {
        id: getString(provider.id) || randomUUID(),
        name: getString(provider.name).trim() || 'Unnamed',
        baseUrl,
        models: settingsRepo.normalizeModelList(provider.models),
        ...settingsRepo.encryptApiKey(apiKey),
      };
    });

    const providerIds = new Set(providers.map((provider) => provider.id));
    const activeProviderId = getString(rawPayload.activeProviderId);
    const nextActiveProviderId = providerIds.has(activeProviderId) ? activeProviderId : providers[0]?.id ?? null;
    const activeProvider = providers.find((provider) => provider.id === nextActiveProviderId) ?? null;
    const legacyActiveModelId = getString(rawPayload.activeModelId);
    
    const settings: StoredSettings = {
      providers,
      activeProviderId: nextActiveProviderId,
      activeModelId: hasModel(activeProvider, legacyActiveModelId)
        ? legacyActiveModelId
        : firstModelId(activeProvider),
      permissionMode: settingsRepo.normalizePermissionMode(rawPayload.permissionMode),
      workspacePath: process.cwd(),
    };

    await settingsRepo.saveStoredSettings(settings);
    return toPublicSettings(settings);
  });

  ipcMain.handle('settings:save-provider-and-scan', async (_event, rawPayload: SaveProviderPayload) => {
    const payload = settingsRepo.isObject(rawPayload) ? rawPayload : {};
    const settings = await settingsRepo.loadStoredSettings();
    const providerId = getString(payload.id) || randomUUID();
    const existingIndex = settings.providers.findIndex((provider) => provider.id === providerId);
    const existingProvider = existingIndex >= 0 ? settings.providers[existingIndex] : null;
    const baseUrl = normalizeBaseUrl(getString(payload.baseUrl));
    const apiKey = getString(payload.apiKey) || (existingProvider ? settingsRepo.decryptApiKey(existingProvider) : '');
    const models = await fetchAvailableModels(baseUrl, apiKey);
    const savedSecret = getString(payload.apiKey) ? settingsRepo.encryptApiKey(getString(payload.apiKey)) : {
      encryptedApiKey: existingProvider?.encryptedApiKey,
      plainApiKey: existingProvider?.plainApiKey,
    };
    
    const nextProvider: StoredProvider = {
      id: providerId,
      name: getString(payload.name).trim() || 'Unnamed',
      baseUrl,
      models,
      ...savedSecret,
    };

    if (existingIndex >= 0) {
      settings.providers[existingIndex] = nextProvider;
    } else {
      settings.providers.push(nextProvider);
    }

    if (!settings.activeProviderId || (existingIndex < 0 && settings.providers.length === 1)) {
      settings.activeProviderId = nextProvider.id;
    }

    if (settings.activeProviderId === nextProvider.id && !hasModel(nextProvider, settings.activeModelId)) {
      settings.activeModelId = firstModelId(nextProvider);
    }

    await settingsRepo.saveStoredSettings(settings);
    return toPublicSettings(settings);
  });

  ipcMain.handle('settings:delete-provider', async (_event, providerId: string) => {
    const settings = await settingsRepo.loadStoredSettings();
    settings.providers = settings.providers.filter((provider) => provider.id !== providerId);

    if (settings.activeProviderId === providerId) {
      const nextProvider = settings.providers[0] ?? null;
      settings.activeProviderId = nextProvider?.id ?? null;
      settings.activeModelId = firstModelId(nextProvider);
    }

    await settingsRepo.saveStoredSettings(settings);
    return toPublicSettings(settings);
  });

  ipcMain.handle('settings:set-active-provider', async (_event, providerId: string) => {
    const settings = await settingsRepo.loadStoredSettings();
    const provider = settings.providers.find((item) => item.id === providerId);
    if (!provider) throw new Error('Provider không tồn tại.');

    settings.activeProviderId = provider.id;
    if (!hasModel(provider, settings.activeModelId)) {
      settings.activeModelId = firstModelId(provider);
    }

    await settingsRepo.saveStoredSettings(settings);
    return toPublicSettings(settings);
  });

  ipcMain.handle('settings:set-active-model', async (_event, modelId: string) => {
    const settings = await settingsRepo.loadStoredSettings();
    settings.activeModelId = modelId || null;
    await settingsRepo.saveStoredSettings(settings);
    return toPublicSettings(settings);
  });

  ipcMain.handle('settings:set-permission-mode', async (_event, permissionMode: PermissionMode) => {
    const settings = await settingsRepo.loadStoredSettings();
    settings.permissionMode = settingsRepo.normalizePermissionMode(permissionMode);
    await settingsRepo.saveStoredSettings(settings);
    return toPublicSettings(settings);
  });
}
