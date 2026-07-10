import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron';
import { importKnowledgeFiles, isWorkspaceKnowledgeSyncing, knowledgeBaseUseCase, removeKnowledgeDocument, stopWorkspaceKnowledgeSync, syncWorkspaceKnowledge } from '../knowledgeRuntime.js';
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
    return respond(async () => {
      const workspacePath = await workspaceManager.getWorkspaceRoot();
      return { ...await knowledgeBaseUseCase.list(workspacePath), watching: isWorkspaceKnowledgeSyncing(workspacePath) };
    });
  });

  ipcMain.handle('knowledge:select-and-import', async () => {
    return respond(async () => {
      const options: OpenDialogOptions = {
        title: 'Thêm tài liệu vào cơ sở tri thức',
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Tài liệu văn bản', extensions: ['txt', 'md', 'mdx', 'rst', 'html', 'htm', 'json', 'jsonl', 'csv', 'tsv', 'yaml', 'yml', 'xml', 'log', 'sql'] },
          { name: 'Mọi tệp', extensions: ['*'] },
        ],
      };
      const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      if (result.canceled || result.filePaths.length === 0) return { canceled: true, imported: [], warnings: [] };
      const imported = await importKnowledgeFiles(await workspaceManager.getWorkspaceRoot(), result.filePaths);
      return { canceled: false, ...imported };
    });
  });

  ipcMain.handle('knowledge:sync-workspace', async () => {
    return respond(async () => syncWorkspaceKnowledge(await workspaceManager.getWorkspaceRoot()));
  });

  ipcMain.handle('knowledge:stop-workspace-sync', async () => {
    return respond(stopWorkspaceKnowledgeSync);
  });

  ipcMain.handle('knowledge:remove', async (_event, rawDocumentId: unknown) => {
    return respond(async () => removeKnowledgeDocument(await workspaceManager.getWorkspaceRoot(), typeof rawDocumentId === 'string' ? rawDocumentId : ''));
  });
}
