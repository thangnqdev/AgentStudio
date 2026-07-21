import { ipcMain, dialog, BrowserWindow, type OpenDialogOptions } from 'electron';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';
import { settingsRepo } from '../infrastructure/JsonSettingsRepository.js';
import { FileSystemToolExecutor } from '../infrastructure/tools/FileSystemToolExecutor.js';
import { parseChatHistoryInput } from '../application/services/chatHistoryInput.js';
import type { ManageWorkspaceProjects } from '../application/usecases/ManageWorkspaceProjects.js';

const workspaceFileExecutor = new FileSystemToolExecutor();

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function registerWorkspaceIpc(win: BrowserWindow | null, projects: ManageWorkspaceProjects) {
  ipcMain.handle('workspace:get-current', async () => {
    return { path: await workspaceManager.getSelectedWorkspaceRoot() ?? '' };
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
      return { path: await workspaceManager.getSelectedWorkspaceRoot() ?? '', canceled: true };
    }

    const selected = await projects.select(result.filePaths[0]);
    return { path: selected.path, canceled: false };
  });

  ipcMain.handle('workspace:list-projects', () => projects.list());

  ipcMain.handle('workspace:activate', (_event, rawPath: unknown) => (
    projects.activate(getString(rawPath))
      .then((data) => ({ success: true as const, data }))
      .catch((error: unknown) => ({ success: false as const, error: errorMessage(error) }))
  ));

  ipcMain.handle('workspace:remove-recent', (_event, rawPath: unknown) => (
    projects.remove(getString(rawPath))
      .then((data) => ({ success: true as const, data }))
      .catch((error: unknown) => ({ success: false as const, error: errorMessage(error) }))
  ));

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

  ipcMain.handle('chat:load-workspace', async () => {
    const workspaceRoot = await workspaceManager.getWorkspaceRoot();
    return parseChatHistoryInput(await workspaceManager.loadWorkspaceChatHistory(workspaceRoot));
  });

  ipcMain.handle('chat:save-workspace', async (_event, rawPayload: unknown) => {
    const workspaceRoot = await workspaceManager.getWorkspaceRoot();
    const payload = parseChatHistoryInput(rawPayload);
    return workspaceManager.saveWorkspaceChatHistory({ ...payload, workspacePath: workspaceRoot });
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Không thể cập nhật dự án.';
}
