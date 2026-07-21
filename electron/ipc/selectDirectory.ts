import { dialog, type BrowserWindow, type OpenDialogOptions } from 'electron';

export async function selectDirectory(win: BrowserWindow | null, title: string) {
  const options: OpenDialogOptions = { title, properties: ['openDirectory'] };
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
  return result.canceled ? '' : result.filePaths[0] ?? '';
}
