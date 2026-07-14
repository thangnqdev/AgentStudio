import { ipcMain } from 'electron';
import { agentProfileManager } from '../agentProfileRuntime.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';

function respond<T>(task: () => Promise<T>) {
  return task().then((data) => ({ success: true as const, data })).catch((error: unknown) => ({
    success: false as const,
    error: error instanceof Error ? error.message : 'Agent profile operation failed.',
  }));
}

function readPayload(value: unknown) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return { profileId: '', value: false };
  const payload = value as Record<string, unknown>;
  const profileId = typeof payload.profileId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(payload.profileId) ? payload.profileId : '';
  return { profileId, value: payload.value === true };
}

export function registerAgentProfileIpc() {
  ipcMain.handle('agent-profiles:list', () => respond(async () => agentProfileManager.list(await workspaceManager.getWorkspaceRoot())));
  ipcMain.handle('agent-profiles:set-enabled', (_event, raw: unknown) => respond(async () => {
    const payload = readPayload(raw);
    if (!payload.profileId) throw new Error('profileId is required.');
    return agentProfileManager.setEnabled(await workspaceManager.getWorkspaceRoot(), payload.profileId, payload.value);
  }));
  ipcMain.handle('agent-profiles:set-trusted', (_event, raw: unknown) => respond(async () => {
    const payload = readPayload(raw);
    if (!payload.profileId) throw new Error('profileId is required.');
    return agentProfileManager.setTrusted(await workspaceManager.getWorkspaceRoot(), payload.profileId, payload.value);
  }));
}
