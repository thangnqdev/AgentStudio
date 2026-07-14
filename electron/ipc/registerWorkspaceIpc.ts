import { ipcMain, dialog, BrowserWindow, type OpenDialogOptions } from 'electron';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';
import { settingsRepo } from '../infrastructure/JsonSettingsRepository.js';
import { stopWorkspaceKnowledgeSync } from '../knowledgeRuntime.js';
import { FileSystemToolExecutor } from '../infrastructure/tools/FileSystemToolExecutor.js';

const workspaceFileExecutor = new FileSystemToolExecutor();

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function registerWorkspaceIpc(win: BrowserWindow | null) {
  ipcMain.handle('workspace:get-current', async () => {
    return { path: await workspaceManager.getWorkspaceRoot() };
  });

  ipcMain.handle('workspace:select-directory', async () => {
    const dialogOptions: OpenDialogOptions = {
      title: 'Chọn repository / workspace',
      properties: ['openDirectory'],
    };
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);

    if (result.canceled || !result.filePaths[0]) {
      return { path: await workspaceManager.getWorkspaceRoot(), canceled: true };
    }

    const settings = await settingsRepo.loadStoredSettings();
    await stopWorkspaceKnowledgeSync();
    settings.workspacePath = result.filePaths[0];
    await settingsRepo.saveStoredSettings(settings);
    return { path: settings.workspacePath, canceled: false };
  });

  ipcMain.handle('workspace:write-file', async (_event, rawPayload: unknown) => {
    try {
      const payload = isObject(rawPayload) ? rawPayload : {};
      
      const settings = await settingsRepo.loadStoredSettings();
      if (settings.permissionMode === 'read-only') {
        return { success: false, error: 'Cannot apply code: Permission mode is set to read-only.' };
      }

      const workspaceRoot = await workspaceManager.getWorkspaceRoot();
      const result = await workspaceFileExecutor.writeFile({ path: getString(payload.path), content: getString(payload.content) }, workspaceRoot, 'workspace-write');
      if (!result.ok) return { success: false, error: result.output };
      return { success: true, path: getString(payload.path) };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('chat:load-workspace', async (_event, rawWorkspacePath?: string) => {
    return workspaceManager.loadWorkspaceChatHistory(getString(rawWorkspacePath) || await workspaceManager.getWorkspaceRoot());
  });

  ipcMain.handle('chat:save-workspace', async (_event, rawPayload: unknown) => {
    const payload = typeof rawPayload === 'object' && rawPayload !== null ? rawPayload : {};
    return workspaceManager.saveWorkspaceChatHistory(payload);
  });
}
