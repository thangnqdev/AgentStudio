import { ipcMain } from 'electron';
import { gitAdapter } from '../infrastructure/SimpleGitAdapter.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';

export function registerGitIpc() {
  ipcMain.handle('git:get-branch', async () => {
    return gitAdapter.getBranch(await workspaceManager.getWorkspaceRoot());
  });
}
