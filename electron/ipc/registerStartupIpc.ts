import { ipcMain, type BrowserWindow } from 'electron';

import { SplashWindow } from '../infrastructure/SplashWindow.js';

export function registerStartupIpc(getMainWindow: () => BrowserWindow | null, splashWindow: SplashWindow): void {
  ipcMain.on('app:renderer-ready', (event) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return;
    splashWindow.revealMainWindow();
  });
}
