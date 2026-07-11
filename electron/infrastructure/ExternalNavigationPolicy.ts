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
}
