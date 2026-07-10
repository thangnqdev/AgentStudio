import { ipcMain } from 'electron';
import { validateWebSearchSettings } from '../application/services/webSearchSettings.js';
import { webSearchSettingsRepository } from '../infrastructure/WebSearchSettingsRepository.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function registerWebSearchIpc() {
  ipcMain.handle('web-search:load-settings', async () => ({ success: true as const, settings: await webSearchSettingsRepository.loadPublic() }));

  ipcMain.handle('web-search:save-settings', async (_event, rawPayload: unknown) => {
    try {
      const payload = isObject(rawPayload) ? rawPayload : {};
      const existing = await webSearchSettingsRepository.loadPublic();
      const provider = getString(payload.provider);
      const settings = validateWebSearchSettings({
        provider: provider as never,
        baseUrl: getString(payload.baseUrl),
        apiKey: getString(payload.apiKey),
        model: getString(payload.model),
      }, existing.provider === provider && existing.hasApiKey);
      return { success: true as const, settings: await webSearchSettingsRepository.save(settings) };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Unable to save web search settings.' };
    }
  });
}
