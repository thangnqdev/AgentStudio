import { app, ipcMain, BrowserWindow } from 'electron';

export function registerAppIpc(win: BrowserWindow | null) {
  ipcMain.handle('ping', () => 'pong');
  ipcMain.handle('app:get-version', () => app.getVersion());

  ipcMain.on('window:minimize', () => win?.minimize());
  ipcMain.on('window:maximize', () => {
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window:close', () => win?.close());
}
