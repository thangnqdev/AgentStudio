import { ipcMain, type BrowserWindow } from 'electron';

import { ManageAppUpdate } from '../application/usecases/ManageAppUpdate.js';

export function registerUpdateIpc(getWindow: () => BrowserWindow | null, appUpdate: ManageAppUpdate): void {
  ipcMain.handle('update:get-status', () => ({ success: true, data: appUpdate.getStatus() }));
  ipcMain.handle('update:check', () => appUpdate.checkForUpdates().then((data) => ({ success: true, data })));
  ipcMain.handle('update:download', () => appUpdate.downloadUpdate().then((data) => ({ success: true, data })));
  ipcMain.handle('update:install', () => {
    appUpdate.quitAndInstall();
    return { success: true, data: { ok: true } };
  });

  appUpdate.subscribe((snapshot) => {
    const win = getWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send('update:status', snapshot);
  });
}
