import { ipcMain } from 'electron';
import type { ManageThemePreference } from '../application/usecases/ManageThemePreference.js';
import type { ThemePreference } from '../domain/entities/theme.js';

export function registerThemeIpc(theme: ManageThemePreference): void {
  ipcMain.handle('theme:load', async () => {
    try {
      return { success: true as const, data: await theme.load() };
    } catch (error) {
      return { success: false as const, error: errorMessage(error) };
    }
  });
  ipcMain.handle('theme:save', async (_event, rawPreference: unknown) => {
    try {
      const preference = readThemePreference(rawPreference);
      await theme.save(preference);
      return { success: true as const, data: preference };
    } catch (error) {
      return { success: false as const, error: errorMessage(error) };
    }
  });
}

function readThemePreference(value: unknown): ThemePreference {
  if (value === 'system' || value === 'light' || value === 'dark') return value;
  throw new Error('Theme preference không hợp lệ.');
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Không thể lưu theme preference.';
}
