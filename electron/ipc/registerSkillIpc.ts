import { ipcMain } from 'electron';
import { skillManager } from '../skillRuntime.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function respond<T>(task: () => Promise<T>) {
  return task().then((data) => ({ success: true as const, data })).catch((error: unknown) => ({
    success: false as const,
    error: error instanceof Error ? error.message : 'Skill operation failed.',
  }));
}

export function registerSkillIpc() {
  ipcMain.handle('skills:list', () => respond(async () => skillManager.list(await workspaceManager.getWorkspaceRoot())));
  ipcMain.handle('skills:set-enabled', (_event, rawPayload: unknown) => respond(async () => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const skillId = typeof payload.skillId === 'string' ? payload.skillId : '';
    if (!skillId) throw new Error('skillId is required.');
    return skillManager.setEnabled(await workspaceManager.getWorkspaceRoot(), skillId, payload.enabled === true);
  }));
  ipcMain.handle('skills:set-trusted', (_event, rawPayload: unknown) => respond(async () => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const skillId = typeof payload.skillId === 'string' ? payload.skillId : '';
    if (!skillId) throw new Error('skillId is required.');
    return skillManager.setTrusted(await workspaceManager.getWorkspaceRoot(), skillId, payload.trusted === true);
  }));
}
