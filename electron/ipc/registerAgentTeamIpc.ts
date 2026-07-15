import { ipcMain } from 'electron';
import { agentTeamEventHub, agentTeamManager, agentWorkerRecovery } from '../agentRuntime.js';

export function registerAgentTeamIpc() {
  ipcMain.handle('agent:teams:get', async (event, rawScopeId: unknown) => {
    const scopeId = validId(rawScopeId);
    if (!scopeId) return { success: false as const, error: 'Agent team scope is invalid.' };
    try {
      agentTeamEventHub.attach(scopeId, event.sender);
      await agentWorkerRecovery;
      return { success: true as const, data: await agentTeamManager.view(scopeId) };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Could not load agent team.' };
    }
  });
}

function validId(value: unknown) {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !value.includes('\0') ? value : '';
}
