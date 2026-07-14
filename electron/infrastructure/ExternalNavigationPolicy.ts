import { shell, type BrowserWindow } from 'electron';

const ALLOWED_EXTERNAL_URLS = new Set(['https://app.tavily.com/']);

function isAllowedExternalUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return ALLOWED_EXTERNAL_URLS.has(`${url.protocol}//${url.host}/`);
  } catch {
    return false;
  }
}

export function configureExternalNavigation(win: BrowserWindow) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event) => {
    // The main renderer never needs a full-page navigation. Blocking all of them
    // keeps the high-privilege preload bridge off untrusted origins.
    event.preventDefault();
  });
  win.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
}
