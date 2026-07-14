import { describe, expect, it } from 'vitest';
import type {
  ModelMetadata,
  StoredProvider,
  StoredSettings,
} from '../../domain/entities/settings.js';
import type { IProviderModelCatalog } from '../../domain/ports/IProviderModelCatalog.js';
import type { ISettingsRepository } from '../../domain/ports/ISettingsRepository.js';
import { ManageProviderSettings } from './ManageProviderSettings.js';

function createHarness(initial: StoredSettings, models: ModelMetadata[] = [{ id: 'model-new' }]) {
  let stored = structuredClone(initial);
  const catalogCalls: Array<{ baseUrl: string; apiKey: string }> = [];
  const repository: ISettingsRepository = {
    loadStoredSettings: async () => structuredClone(stored),
    saveStoredSettings: async (settings) => {
      stored = structuredClone(settings);
    },
    encryptApiKey: (apiKey) => apiKey ? { encryptedApiKey: `encrypted:${apiKey}` } : {},
    decryptApiKey: (provider) => provider.encryptedApiKey?.replace('encrypted:', '') || '',
  };
  const catalog: IProviderModelCatalog = {
    listModels: async (baseUrl, apiKey) => {
      catalogCalls.push({ baseUrl, apiKey });
      return models;
    },
  };
  const useCase = new ManageProviderSettings(repository, catalog, {
    createId: () => 'generated-provider',
    defaultWorkspacePath: () => '/workspace',
  });
  return { useCase, catalogCalls, stored: () => structuredClone(stored) };
}

function settings(provider?: StoredProvider): StoredSettings {
  return {
    providers: provider ? [provider] : [],
    activeProviderId: provider?.id ?? null,
    activeModelId: provider?.models[0]?.id ?? null,
    permissionMode: 'workspace-write',
    workspacePath: '/workspace',
  };
}

describe('ManageProviderSettings', () => {
  it('updates a provider while retaining its existing API key', async () => {
    const existing: StoredProvider = {
      id: 'provider-1',
      name: 'Existing',
      baseUrl: 'https://old.example/v1',
      models: [{ id: 'model-old' }],
      encryptedApiKey: 'encrypted:existing-key',
    };
    const harness = createHarness(settings(existing));

    await harness.useCase.saveProviderAndScan({
      id: existing.id,
      name: 'Updated',
      baseUrl: 'models.example/v1',
    });

    expect(harness.catalogCalls).toEqual([{
      baseUrl: 'http://models.example/v1',
      apiKey: 'existing-key',
    }]);
    expect(harness.stored().providers[0]).toMatchObject({
      id: existing.id,
      name: 'Updated',
      encryptedApiKey: existing.encryptedApiKey,
      models: [{ id: 'model-new' }],
    });
    expect(harness.stored().activeModelId).toBe('model-new');
  });

  it('imports legacy settings through injected persistence and ID generation', async () => {
    const harness = createHarness(settings());

    const result = await harness.useCase.importLegacy({
      providers: [{ name: 'Legacy', baseUrl: 'http://localhost:11434', apiKey: 'secret', models: ['m1'] }],
      activeModelId: 'm1',
      permissionMode: 'read-only',
    });

    expect(result.activeProviderId).toBe('generated-provider');
    expect(result.activeModelId).toBe('m1');
    expect(harness.stored()).toMatchObject({
      permissionMode: 'read-only',
      workspacePath: '/workspace',
      providers: [{ id: 'generated-provider', encryptedApiKey: 'encrypted:secret' }],
    });
  });
});
