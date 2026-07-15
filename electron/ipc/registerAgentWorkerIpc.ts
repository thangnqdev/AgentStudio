import { ipcMain } from 'electron';
import { agentWorkerManager, agentWorkerRecovery } from '../agentRuntime.js';

export function registerAgentWorkerIpc() {
  ipcMain.handle('agent:workers:list', async (_event, rawScopeId: unknown) => {
    const scopeId = validId(rawScopeId);
    if (!scopeId) return { success: false as const, error: 'Agent worker scope is invalid.' };
    try {
      await agentWorkerRecovery;
      return { success: true as const, data: await agentWorkerManager.list(scopeId) };
    } catch (error) {
      return { success: false as const, error: message(error, 'Could not list agent workers.') };
    }
  });

  ipcMain.handle('agent:workers:stop', async (_event, rawPayload: unknown) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const scopeId = validId(payload.scopeId);
    const agentId = validId(payload.agentId);
    if (!scopeId || !agentId) return { success: false as const, error: 'Agent worker stop input is invalid.' };
    try {
      const stopped = await agentWorkerManager.stopInScope(scopeId, agentId);
      return stopped ? { success: true as const, data: { stopped: true } } : { success: false as const, error: 'Agent is not running in this scope.' };
    } catch (error) {
      return { success: false as const, error: message(error, 'Could not stop agent worker.') };
    }
  });

  ipcMain.on('agent:workers:approval', (_event, rawPayload: unknown) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const agentId = validId(payload.agentId);
    const actionId = validId(payload.actionId);
    if (!agentId || !actionId || typeof payload.approved !== 'boolean') return;
    agentWorkerManager.respondToApproval(agentId, actionId, payload.approved);
  });
}

function validId(value: unknown) {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && !value.includes('\0') ? value : '';
}
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }
