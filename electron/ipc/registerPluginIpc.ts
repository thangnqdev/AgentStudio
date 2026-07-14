import { ipcMain } from 'electron';
import { pluginManager } from '../pluginRuntime.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';

function respond<T>(task: () => Promise<T>) {
  return task().then((data) => ({ success: true as const, data })).catch((error: unknown) => ({
    success: false as const,
    error: error instanceof Error ? error.message : 'Plugin operation failed.',
  }));
}

function readPayload(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { pluginId: '', value: false };
  const payload = value as Record<string, unknown>;
  const pluginId = typeof payload.pluginId === 'string' && /^[a-f0-9]{20}$/.test(payload.pluginId) ? payload.pluginId : '';
  return { pluginId, value: payload.value === true };
}

export function registerPluginIpc() {
  ipcMain.handle('plugins:list', () => respond(async () => pluginManager.list(await workspaceManager.getWorkspaceRoot())));
  ipcMain.handle('plugins:set-enabled', (_event, raw: unknown) => respond(async () => {
    const payload = readPayload(raw);
    if (!payload.pluginId) throw new Error('pluginId is required.');
    return pluginManager.setEnabled(await workspaceManager.getWorkspaceRoot(), payload.pluginId, payload.value);
  }));
  ipcMain.handle('plugins:set-trusted', (_event, raw: unknown) => respond(async () => {
    const payload = readPayload(raw);
    if (!payload.pluginId) throw new Error('pluginId is required.');
    return pluginManager.setTrusted(await workspaceManager.getWorkspaceRoot(), payload.pluginId, payload.value);
  }));
}
