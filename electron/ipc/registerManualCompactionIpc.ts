import { ipcMain } from 'electron';
import { parseManualCompactionInput } from '../application/services/manualCompactionInput.js';
import { CompactConversationHistory } from '../application/usecases/CompactConversationHistory.js';
import { lifecycleHookDispatcher } from '../hookRuntime.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';

const compactConversation = new CompactConversationHistory(lifecycleHookDispatcher);

export function registerManualCompactionIpc() {
  ipcMain.handle('chat:compact', async (_event, raw: unknown) => {
    try {
      const input = parseManualCompactionInput(raw);
      const workspaceRoot = await workspaceManager.getWorkspaceRoot();
      return { success: true as const, data: await compactConversation.execute({ ...input, workspaceRoot }) };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Không thể compact hội thoại.' };
    }
  });
}
