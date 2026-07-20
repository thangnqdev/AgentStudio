import type { PermissionMode } from '../../domain/entities/agent.js';
import type {
  LegacySettingsInput,
  SaveProviderInput,
  StoredProvider,
  StoredSettings,
} from '../../domain/entities/settings.js';
import type { IProviderModelCatalog } from '../../domain/ports/IProviderModelCatalog.js';
import type { ISettingsRepository } from '../../domain/ports/ISettingsRepository.js';
import {
  firstModelId,
  hasModel,
  normalizeBaseUrl,
  normalizeModelList,
  toPublicSettings,
} from '../services/providerSettings.js';

interface ManageProviderSettingsDependencies {
  createId: () => string;
  defaultWorkspacePath: () => string;
}

export class ManageProviderSettings {
  private readonly settings: ISettingsRepository;
  private readonly models: IProviderModelCatalog;
  private readonly dependencies: ManageProviderSettingsDependencies;

  constructor(
    settings: ISettingsRepository,
    models: IProviderModelCatalog,
    dependencies: ManageProviderSettingsDependencies,
  ) {
    this.settings = settings;
    this.models = models;
    this.dependencies = dependencies;
  }

  async load() {
    return toPublicSettings(await this.settings.loadStoredSettings());
  }

  async importLegacy(input: LegacySettingsInput | null) {
    if (!input) return this.load();
    const providers = input.providers.map((provider) => ({
      id: provider.id || this.dependencies.createId(),
      name: provider.name?.trim() || 'Unnamed',
      baseUrl: provider.baseUrl?.trim() || '',
      models: normalizeModelList(provider.models),
      ...this.settings.encryptApiKey(provider.apiKey || ''),
    }));
    const providerIds = new Set(providers.map((provider) => provider.id));
    const requestedProviderId = input.activeProviderId || '';
    const activeProviderId = providerIds.has(requestedProviderId)
      ? requestedProviderId
      : providers[0]?.id ?? null;
    const activeProvider = providers.find((provider) => provider.id === activeProviderId);
    const requestedModelId = input.activeModelId || '';
    const activeModelId = hasModel(activeProvider, requestedModelId)
      ? requestedModelId
      : firstModelId(activeProvider);
    const settings: StoredSettings = {
      providers,
      activeProviderId,
      activeModelId,
      fallbackModelId: validFallbackModel(activeProvider, activeModelId, input.fallbackModelId),
      permissionMode: input.permissionMode ?? 'workspace-write',
      workspacePath: this.dependencies.defaultWorkspacePath(),
      themePreference: 'system',
    };
    await this.settings.saveStoredSettings(settings);
    return toPublicSettings(settings);
  }

  async saveProviderAndScan(input: SaveProviderInput) {
    const settings = await this.settings.loadStoredSettings();
    const existingProvider = input.id
      ? settings.providers.find((provider) => provider.id === input.id)
      : undefined;
    const baseUrl = normalizeBaseUrl(input.baseUrl || '');
    const apiKey = input.apiKey || (existingProvider ? this.settings.decryptApiKey(existingProvider) : '');
    const models = await this.models.listModels(baseUrl, apiKey);
    return this.upsertProvider(settings, input, models);
  }

  async saveProvider(input: SaveProviderInput) {
    const settings = await this.settings.loadStoredSettings();
    const existingProvider = input.id
      ? settings.providers.find((provider) => provider.id === input.id)
      : undefined;
    const models = input.models === undefined
      ? existingProvider?.models.map((model) => ({ ...model })) ?? []
      : normalizeModelList(input.models);
    return this.upsertProvider(settings, input, models);
  }

  private async upsertProvider(
    settings: StoredSettings,
    input: SaveProviderInput,
    models: StoredProvider['models'],
  ) {
    const providerId = input.id || this.dependencies.createId();
    const existingIndex = settings.providers.findIndex((provider) => provider.id === providerId);
    const existingProvider = settings.providers[existingIndex];
    const secret = input.apiKey
      ? this.settings.encryptApiKey(input.apiKey)
      : existingSecret(existingProvider);
    const provider: StoredProvider = {
      id: providerId,
      name: input.name?.trim() || 'Unnamed',
      baseUrl: normalizeBaseUrl(input.baseUrl || ''),
      models,
      ...secret,
    };
    if (existingIndex >= 0) settings.providers[existingIndex] = provider;
    else settings.providers.push(provider);
    if (!settings.activeProviderId || (existingIndex < 0 && settings.providers.length === 1)) {
      settings.activeProviderId = provider.id;
    }
    if (settings.activeProviderId === provider.id && !hasModel(provider, settings.activeModelId)) {
      settings.activeModelId = firstModelId(provider);
    }
    if (settings.activeProviderId === provider.id) {
      settings.fallbackModelId = validFallbackModel(provider, settings.activeModelId, settings.fallbackModelId);
    }
    return this.saveAndProject(settings);
  }

  async deleteProvider(providerId: string) {
    const settings = await this.settings.loadStoredSettings();
    settings.providers = settings.providers.filter((provider) => provider.id !== providerId);
    if (settings.activeProviderId === providerId) {
      const nextProvider = settings.providers[0];
      settings.activeProviderId = nextProvider?.id ?? null;
      settings.activeModelId = firstModelId(nextProvider);
      settings.fallbackModelId = null;
    }
    return this.saveAndProject(settings);
  }

  async setActiveProvider(providerId: string) {
    const settings = await this.settings.loadStoredSettings();
    const provider = settings.providers.find((item) => item.id === providerId);
    if (!provider) throw new Error('Provider không tồn tại.');
    settings.activeProviderId = provider.id;
    if (!hasModel(provider, settings.activeModelId)) settings.activeModelId = firstModelId(provider);
    settings.fallbackModelId = validFallbackModel(provider, settings.activeModelId, settings.fallbackModelId);
    return this.saveAndProject(settings);
  }

  async setActiveModel(modelId: string) {
    const settings = await this.settings.loadStoredSettings();
    const provider = settings.providers.find((item) => item.id === settings.activeProviderId);
    if (!hasModel(provider, modelId)) throw new Error('Model không thuộc provider đang hoạt động.');
    settings.activeModelId = modelId;
    if (settings.fallbackModelId === modelId) settings.fallbackModelId = null;
    return this.saveAndProject(settings);
  }

  async setFallbackModel(modelId: string) {
    const settings = await this.settings.loadStoredSettings();
    const provider = settings.providers.find((item) => item.id === settings.activeProviderId);
    if (!modelId) settings.fallbackModelId = null;
    else if (modelId === settings.activeModelId) throw new Error('Fallback model phải khác model chính.');
    else if (!hasModel(provider, modelId)) throw new Error('Fallback model không thuộc provider đang hoạt động.');
    else settings.fallbackModelId = modelId;
    return this.saveAndProject(settings);
  }

  async setPermissionMode(permissionMode: PermissionMode) {
    const settings = await this.settings.loadStoredSettings();
    settings.permissionMode = permissionMode;
    return this.saveAndProject(settings);
  }

  private async saveAndProject(settings: StoredSettings) {
    await this.settings.saveStoredSettings(settings);
    return toPublicSettings(settings);
  }
}

function existingSecret(provider: StoredProvider | undefined) {
  return {
    encryptedApiKey: provider?.encryptedApiKey,
    plainApiKey: provider?.plainApiKey,
  };
}

function validFallbackModel(provider: StoredProvider | undefined, activeModelId: string | null, fallbackModelId: string | null | undefined) {
  return fallbackModelId !== activeModelId && hasModel(provider, fallbackModelId) ? fallbackModelId! : null;
}
