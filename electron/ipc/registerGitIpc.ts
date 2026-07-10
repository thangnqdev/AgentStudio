import { ipcMain } from 'electron';
import { gitAdapter } from '../infrastructure/SimpleGitAdapter.js';

export function registerGitIpc() {
  ipcMain.handle('git:get-branch', async (_event, workspacePath: string) => {
    return gitAdapter.getBranch(workspacePath);
  });
}
