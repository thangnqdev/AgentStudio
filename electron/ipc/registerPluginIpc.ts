import { ipcMain, type BrowserWindow } from 'electron';
import { pluginManager } from '../pluginRuntime.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';
import { selectDirectory } from './selectDirectory.js';

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

export function registerPluginIpc(win: BrowserWindow | null) {
  ipcMain.handle('plugins:list', () => respond(async () => pluginManager.list(await currentWorkspaceRoot())));
  ipcMain.handle('plugins:set-enabled', (_event, raw: unknown) => respond(async () => {
    const payload = readPayload(raw);
    if (!payload.pluginId) throw new Error('pluginId is required.');
    return pluginManager.setEnabled(await currentWorkspaceRoot(), payload.pluginId, payload.value);
  }));
  ipcMain.handle('plugins:set-trusted', (_event, raw: unknown) => respond(async () => {
    const payload = readPayload(raw);
    if (!payload.pluginId) throw new Error('pluginId is required.');
    return pluginManager.setTrusted(await currentWorkspaceRoot(), payload.pluginId, payload.value);
  }));
  ipcMain.handle('plugins:install', () => respond(async () => {
    const sourcePath = await selectDirectory(win, 'Chọn thư mục plugin');
    if (!sourcePath) return pluginManager.list(await currentWorkspaceRoot());
    return pluginManager.install(await currentWorkspaceRoot(), sourcePath);
  }));
  ipcMain.handle('plugins:remove', (_event, rawPluginId: unknown) => respond(async () => {
    const pluginId = typeof rawPluginId === 'string' && /^[a-f0-9]{20}$/.test(rawPluginId) ? rawPluginId : '';
    if (!pluginId) throw new Error('pluginId is required.');
    return pluginManager.remove(await currentWorkspaceRoot(), pluginId);
  }));
}

async function currentWorkspaceRoot() {
  return await workspaceManager.getSelectedWorkspaceRoot() ?? '';
}
