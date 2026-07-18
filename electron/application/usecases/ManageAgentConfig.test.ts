import { describe, expect, it, vi } from 'vitest';
import type { StoredSettings } from '../../domain/entities/settings.js';
import type { ISettingsRepository } from '../../domain/ports/ISettingsRepository.js';
import { ManageAgentConfig } from './ManageAgentConfig.js';

function harness() {
  let stored: StoredSettings = {
    providers: [{
      id: 'provider-1', name: 'Local', baseUrl: 'https://provider.invalid',
      encryptedApiKey: 'encrypted-secret',
      models: [{ id: 'model-a', contextWindow: 8_192 }, { id: 'model-b', contextWindow: 16_384 }],
    }],
    activeProviderId: 'provider-1', activeModelId: 'model-a', fallbackModelId: 'model-b',
    permissionMode: 'workspace-write', workspacePath: '/workspace',
  };
  const saveStoredSettings = vi.fn(async (settings: StoredSettings) => { stored = structuredClone(settings); });
  const repository: ISettingsRepository = {
    loadStoredSettings: async () => structuredClone(stored), saveStoredSettings,
    encryptApiKey: () => ({}), decryptApiKey: () => 'private-secret',
  };
  return { config: new ManageAgentConfig(repository), saveStoredSettings, stored: () => stored };
}

describe('ManageAgentConfig', () => {
  it('reads only allow-listed public values and options', async () => {
    const { config } = harness();
    expect(await config.read('model')).toEqual({
      setting: 'model', value: 'model-a', options: ['model-a', 'model-b'],
    });
    expect(await config.read('fallbackModel')).toEqual({
      setting: 'fallbackModel', value: 'model-b', options: ['disabled', 'model-b'],
    });
    await expect(config.read('apiKey')).rejects.toThrow('Unknown AgentStudio setting');
  });

  it('persists a model change, clears an identical fallback and updates runtime limits', async () => {
    const { config, saveStoredSettings, stored } = harness();
    const result = await config.write('model', 'model-b');
    expect(stored()).toMatchObject({ activeModelId: 'model-b', fallbackModelId: null });
    expect(result.runtime).toEqual({
      model: 'model-b', fallbackModels: [], contextWindow: 16_384, permissionMode: 'workspace-write',
    });
    expect(result.publicSettings.providers[0]).toMatchObject({ hasApiKey: true });
    expect(result.publicSettings.providers[0]).not.toHaveProperty('encryptedApiKey');
    expect(saveStoredSettings).toHaveBeenCalledOnce();
  });

  it('validates fallback and permission values before saving', async () => {
    const { config, saveStoredSettings, stored } = harness();
    await expect(config.write('fallbackModel', 'model-a')).rejects.toThrow('must differ');
    await expect(config.write('permissions.defaultMode', 'unrestricted')).rejects.toThrow('must be read-only');
    expect(saveStoredSettings).not.toHaveBeenCalled();
    const disabled = await config.write('fallbackModel', 'default');
    expect(stored().fallbackModelId).toBeNull();
    expect(disabled.newValue).toBe('disabled');
  });
});
