import { ipcMain } from 'electron';
import { ListLifecycleHooks } from '../application/usecases/ListLifecycleHooks.js';
import { lifecycleHookSource } from '../hookRuntime.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';

const listLifecycleHooks = new ListLifecycleHooks(lifecycleHookSource);

export function registerLifecycleHookIpc() {
  ipcMain.handle('lifecycle-hooks:list', async () => {
    try {
      const workspaceRoot = await workspaceManager.getWorkspaceRoot();
      return { success: true as const, data: await listLifecycleHooks.execute(workspaceRoot) };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Không thể tải lifecycle hooks.' };
    }
  });
}
