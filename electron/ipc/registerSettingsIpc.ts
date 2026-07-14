import { ipcMain } from 'electron';
import type { PermissionMode } from '../domain/entities/agent.js';
import type {
  LegacySettingsInput,
  SaveProviderInput,
} from '../domain/entities/settings.js';
import type { ManageProviderSettings } from '../application/usecases/ManageProviderSettings.js';
export function registerSettingsIpc(settings: ManageProviderSettings) {
  ipcMain.handle('settings:load', () => settings.load());
  ipcMain.handle('settings:import-legacy', (_event, rawPayload: unknown) => (
    settings.importLegacy(readLegacySettings(rawPayload))
  ));
  ipcMain.handle('settings:save-provider-and-scan', (_event, rawPayload: unknown) => (
    settings.saveProviderAndScan(readProvider(rawPayload))
  ));
  ipcMain.handle('settings:save-provider', async (_event, rawPayload: unknown) => {
    try {
      return { success: true as const, data: await settings.saveProvider(readProvider(rawPayload)) };
    } catch (error) {
      return { success: false as const, error: errorMessage(error) };
    }
  });
  ipcMain.handle('settings:delete-provider', (_event, rawProviderId: unknown) => (
    settings.deleteProvider(getString(rawProviderId))
  ));
  ipcMain.handle('settings:set-active-provider', (_event, rawProviderId: unknown) => (
    settings.setActiveProvider(getString(rawProviderId))
  ));
  ipcMain.handle('settings:set-active-model', (_event, rawModelId: unknown) => (
    settings.setActiveModel(getString(rawModelId))
  ));
  ipcMain.handle('settings:set-fallback-model', (_event, rawModelId: unknown) => (
    settings.setFallbackModel(getString(rawModelId))
  ));
  ipcMain.handle('settings:set-permission-mode', (_event, rawMode: unknown) => (
    settings.setPermissionMode(readPermissionMode(rawMode))
  ));
}

function readProvider(value: unknown): SaveProviderInput {
  const provider = isObject(value) ? value : {};
  return {
    id: optionalString(provider.id),
    name: optionalString(provider.name),
    baseUrl: optionalString(provider.baseUrl),
    apiKey: optionalString(provider.apiKey),
    models: provider.models,
  };
}

function readLegacySettings(value: unknown): LegacySettingsInput | null {
  if (!isObject(value) || !Array.isArray(value.providers)) return null;
  return {
    providers: value.providers.filter(isObject).map((provider) => ({
      ...readProvider(provider),
      models: provider.models,
    })),
    activeProviderId: nullableString(value.activeProviderId),
    activeModelId: nullableString(value.activeModelId),
    fallbackModelId: nullableString(value.fallbackModelId),
    permissionMode: optionalPermissionMode(value.permissionMode),
  };
}

function readPermissionMode(value: unknown): PermissionMode {
  const mode = optionalPermissionMode(value);
  if (!mode) throw new Error('Permission mode không hợp lệ.');
  return mode;
}

function optionalPermissionMode(value: unknown): PermissionMode | undefined {
  if (value === 'read-only' || value === 'workspace-write' || value === 'danger-full-access') {
    return value;
  }
  return undefined;
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function nullableString(value: unknown): string | null | undefined {
  return value === null ? null : optionalString(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Không thể lưu provider.';
}
