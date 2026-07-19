import { ipcMain } from 'electron';
import { BrowseWorkspaceUseCase } from '../application/usecases/BrowseWorkspaceUseCase.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';
import { FileSystemWorkspaceBrowser } from '../infrastructure/workspace/FileSystemWorkspaceBrowser.js';

const browseWorkspace = new BrowseWorkspaceUseCase(workspaceManager, new FileSystemWorkspaceBrowser());

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function registerWorkspaceBrowserIpc(): void {
  ipcMain.handle('workspace:list-files', async (_event, rawPayload: unknown) => {
    try {
      const payload = isObject(rawPayload) ? rawPayload : {};
      return { success: true as const, data: { entries: await browseWorkspace.list(getString(payload.directory) || '.') } };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('workspace:read-file', async (_event, rawPayload: unknown) => {
    try {
      const payload = isObject(rawPayload) ? rawPayload : {};
      return { success: true as const, data: { file: await browseWorkspace.read(getString(payload.path)) } };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
