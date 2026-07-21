import { ipcMain, type BrowserWindow } from 'electron';
import { skillManager } from '../skillRuntime.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';
import { selectDirectory } from './selectDirectory.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function respond<T>(task: () => Promise<T>) {
  return task().then((data) => ({ success: true as const, data })).catch((error: unknown) => ({
    success: false as const,
    error: error instanceof Error ? error.message : 'Skill operation failed.',
  }));
}

export function registerSkillIpc(win: BrowserWindow | null) {
  ipcMain.handle('skills:list', () => respond(async () => skillManager.list(await currentWorkspaceRoot())));
  ipcMain.handle('skills:set-enabled', (_event, rawPayload: unknown) => respond(async () => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const skillId = typeof payload.skillId === 'string' ? payload.skillId : '';
    if (!skillId) throw new Error('skillId is required.');
    return skillManager.setEnabled(await currentWorkspaceRoot(), skillId, payload.enabled === true);
  }));
  ipcMain.handle('skills:set-trusted', (_event, rawPayload: unknown) => respond(async () => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const skillId = typeof payload.skillId === 'string' ? payload.skillId : '';
    if (!skillId) throw new Error('skillId is required.');
    return skillManager.setTrusted(await currentWorkspaceRoot(), skillId, payload.trusted === true);
  }));
  ipcMain.handle('skills:install', () => respond(async () => {
    const sourcePath = await selectDirectory(win, 'Chọn thư mục skill có SKILL.md');
    if (!sourcePath) return skillManager.list(await currentWorkspaceRoot());
    return skillManager.install(await currentWorkspaceRoot(), sourcePath);
  }));
  ipcMain.handle('skills:remove', (_event, rawSkillId: unknown) => respond(async () => {
    const skillId = typeof rawSkillId === 'string' ? rawSkillId : '';
    if (!skillId) throw new Error('skillId is required.');
    return skillManager.remove(await currentWorkspaceRoot(), skillId);
  }));
}

async function currentWorkspaceRoot() {
  return await workspaceManager.getSelectedWorkspaceRoot() ?? '';
}
