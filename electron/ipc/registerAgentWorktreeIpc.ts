import { ipcMain } from 'electron';
import { agentWorktreeManager } from '../agentRuntime.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';

export function registerAgentWorktreeIpc() {
  ipcMain.handle('agent:worktree:get-state', async (_event, rawScopeId: unknown) => {
    const scopeId = typeof rawScopeId === 'string' && rawScopeId.length <= 256 ? rawScopeId : '';
    if (!scopeId) return { success: false as const, error: 'Worktree scope is invalid.' };
    try {
      const workspaceRoot = await workspaceManager.getWorkspaceRoot();
      await agentWorktreeManager.restore(scopeId, workspaceRoot);
      return { success: true as const, data: agentWorktreeManager.state(scopeId) };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Could not restore worktree state.' };
    }
  });
}
