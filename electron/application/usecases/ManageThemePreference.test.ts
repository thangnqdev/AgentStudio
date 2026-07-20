import { describe, expect, it, vi } from 'vitest';
import type { StoredSettings } from '../../domain/entities/settings.js';
import type { ISettingsRepository } from '../../domain/ports/ISettingsRepository.js';
import { ManageThemePreference } from './ManageThemePreference.js';

function createHarness() {
  let stored: StoredSettings = {
    providers: [],
    activeProviderId: null,
    activeModelId: null,
    fallbackModelId: null,
    permissionMode: 'workspace-write',
    workspacePath: '/workspace',
    themePreference: 'system',
  };
  const saveStoredSettings = vi.fn(async (settings: StoredSettings) => {
    stored = structuredClone(settings);
  });
  const repository: ISettingsRepository = {
    loadStoredSettings: async () => structuredClone(stored),
    saveStoredSettings,
    encryptApiKey: () => ({}),
    decryptApiKey: () => '',
  };
  return { theme: new ManageThemePreference(repository), saveStoredSettings, stored: () => stored };
}

describe('ManageThemePreference', () => {
  it('loads and persists the preference without changing unrelated settings', async () => {
    const harness = createHarness();

    expect(await harness.theme.load()).toBe('system');
    await harness.theme.save('dark');

    expect(harness.stored()).toMatchObject({ themePreference: 'dark', workspacePath: '/workspace' });
    expect(harness.saveStoredSettings).toHaveBeenCalledOnce();
  });
});
