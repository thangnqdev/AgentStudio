import { ipcMain, type BrowserWindow, type WebContents } from 'electron';

import { SplashWindow } from '../infrastructure/SplashWindow.js';

export function registerStartupIpc(
  getMainWindow: () => BrowserWindow | null,
  splashWindow: SplashWindow,
  rendererReady?: { attach(sender: WebContents): unknown },
): void {
  ipcMain.on('app:renderer-ready', (event) => {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents) return;
    splashWindow.revealMainWindow();
    rendererReady?.attach(event.sender);
  });
}
