import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';
import { knowledgeBaseUseCase } from '../knowledgeRuntime.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';

async function respond<T>(task: () => Promise<T>) {
  try {
    return { success: true as const, data: await task() };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Knowledge base operation failed.' };
  }
}

export function registerKnowledgeIpc(win: BrowserWindow | null) {
  ipcMain.handle('knowledge:list', async () => {
    return respond(async () => knowledgeBaseUseCase.list(await workspaceManager.getWorkspaceRoot()));
  });

  ipcMain.handle('knowledge:select-and-import', async () => {
    return respond(async () => {
      const options: OpenDialogOptions = {
        title: 'Thêm tài liệu vào cơ sở tri thức',
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Tài liệu văn bản', extensions: ['txt', 'md', 'mdx', 'rst', 'html', 'htm', 'json', 'jsonl', 'csv', 'tsv', 'yaml', 'yml', 'xml', 'log'] },
          { name: 'Mọi tệp', extensions: ['*'] },
        ],
      };
      const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      if (result.canceled || result.filePaths.length === 0) return { canceled: true, imported: [], warnings: [] };
      const imported = await knowledgeBaseUseCase.importSelectedFiles(await workspaceManager.getWorkspaceRoot(), result.filePaths);
      return { canceled: false, ...imported };
    });
  });

  ipcMain.handle('knowledge:search', async (_event, rawQuery: unknown) => {
    return respond(async () => knowledgeBaseUseCase.search(
      await workspaceManager.getWorkspaceRoot(),
      typeof rawQuery === 'string' ? rawQuery : '',
    ));
  });

  ipcMain.handle('knowledge:remove', async (_event, rawDocumentId: unknown) => {
    return respond(async () => knowledgeBaseUseCase.remove(await workspaceManager.getWorkspaceRoot(), typeof rawDocumentId === 'string' ? rawDocumentId : ''));
  });
}
