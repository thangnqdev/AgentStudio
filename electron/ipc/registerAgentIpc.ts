import { ipcMain } from 'electron';
import { agentTaskService, agentToolApprovalManager, agentTraceService, runAgentSession } from '../agentRuntime.js';
import { settingsRepo } from '../infrastructure/JsonSettingsRepository.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';
import { knowledgeBaseUseCase } from '../knowledgeRuntime.js';
import { skillManager } from '../skillRuntime.js';
import { PrepareAgentSession } from '../application/usecases/PrepareAgentSession.js';
import { optimizerRepository, safeOptimizer } from '../optimizerRuntime.js';
import { parseAgentStartPayload } from '../application/services/agentStartPayloadValidation.js';

const activeAgentControllers = new Map<string, AbortController>();
const activeAgentTaskIds = new Map<string, string>();
let interruptedTaskRecovery: Promise<void> | null = null;
const prepareAgentSession = new PrepareAgentSession(agentTaskService, knowledgeBaseUseCase, skillManager, agentTraceService, optimizerRepository);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getBoolean(value: unknown) {
  return value === true;
}

export function registerAgentIpc() {
  interruptedTaskRecovery ??= agentTaskService.recoverInterrupted().catch(() => undefined);

  ipcMain.on('ai:chat:stop', (_event, rawPayload: unknown) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const requestId = getString(payload.requestId);
    activeAgentControllers.get(requestId)?.abort();
    agentToolApprovalManager.cancelRequest(requestId);
  });

  ipcMain.on('ai:chat:tool-approval', (_event, rawPayload: unknown) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const requestId = getString(payload.requestId);
    const actionId = getString(payload.actionId);
    if (!requestId || !actionId) return;
    agentToolApprovalManager.respond(requestId, actionId, getBoolean(payload.approved));
  });

  ipcMain.on('ai:chat:start', async (event, rawPayload: unknown) => {
    const payload = parseAgentStartPayload(rawPayload);
    const requestId = getString(payload.requestId);
    const taskId = getString(payload.taskId);

    if (!requestId) {
      event.sender.send('ai:chat:error', { requestId: '', error: 'Thiếu requestId.' });
      return;
    }

    try {
      await interruptedTaskRecovery;
      const controller = new AbortController();
      activeAgentControllers.set(requestId, controller);
      const settings = await settingsRepo.loadStoredSettings();
      const activeProvider = settings.providers.find((provider) => provider.id === settings.activeProviderId);
      if (!activeProvider) {
        throw new Error('Chưa cấu hình provider AI.');
      }

      const workspaceRoot = await workspaceManager.getWorkspaceRoot();
      const tuning = (await safeOptimizer.getState()).active;
      const selectedModel = tuning.modelChoice && activeProvider.models.some((model) => model.id === tuning.modelChoice) ? tuning.modelChoice : settings.activeModelId;
      const fallbackModel = settings.fallbackModelId && activeProvider.models.some((model) => model.id === settings.fallbackModelId) && settings.fallbackModelId !== selectedModel
        ? settings.fallbackModelId
        : null;
      const modelContextWindows = Object.fromEntries(activeProvider.models.flatMap((model) => (
        model.contextWindow ? [[model.id, model.contextWindow] as const] : []
      )));
      const { task, skillContext } = await prepareAgentSession.execute({ payload, taskId, requestId, workspaceRoot });
      activeAgentTaskIds.set(requestId, task.id);

      await runAgentSession(payload, event.sender, {
        baseUrl: activeProvider.baseUrl,
        apiKey: settingsRepo.decryptApiKey(activeProvider),
        model: selectedModel || '',
        fallbackModels: fallbackModel ? [fallbackModel] : [],
        modelContextWindows,
        retryCount: tuning.retryCount,
        contextWindow: activeProvider.models.find(m => m.id === selectedModel)?.contextWindow,
        contextBudgetTokens: tuning.contextBudgetTokens,
        permissionMode: settings.permissionMode,
      }, workspaceRoot, task.knowledgeContext, skillContext, controller.signal, task, tuning);
    } catch (error) {
      if (activeAgentControllers.get(requestId)?.signal.aborted) {
        const activeTaskId = activeAgentTaskIds.get(requestId);
        if (activeTaskId) await agentTaskService.pause(activeTaskId, 'Agent session was stopped.');
        event.sender.send('ai:chat:chunk', { requestId, chunk: '\n\nĐã dừng phản hồi.' });
        event.sender.send('ai:chat:done', { requestId });
      } else {
        const activeTaskId = activeAgentTaskIds.get(requestId);
        if (activeTaskId) await agentTaskService.fail(activeTaskId, error instanceof Error ? error.message : 'Unknown error occurred');
        event.sender.send('ai:chat:error', {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    } finally {
      agentToolApprovalManager.cancelRequest(requestId);
      activeAgentControllers.delete(requestId);
      activeAgentTaskIds.delete(requestId);
    }
  });

  ipcMain.handle('agent:tasks:list-resumable', async () => {
    await interruptedTaskRecovery;
    const workspaceRoot = await workspaceManager.getWorkspaceRoot();
    return { success: true as const, tasks: await agentTaskService.listResumable(workspaceRoot) };
  });

  ipcMain.handle('agent:tasks:fork', async (_event, rawPayload: unknown) => {
    await interruptedTaskRecovery;
    const taskId = getString(isObject(rawPayload) ? rawPayload.taskId : undefined);
    if (!taskId) return { success: false as const, error: 'Thiếu taskId để tạo nhánh.' };
    try {
      const workspaceRoot = await workspaceManager.getWorkspaceRoot();
      return { success: true as const, data: await agentTaskService.fork(taskId, workspaceRoot) };
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : 'Không thể tạo nhánh tác vụ.' };
    }
  });
}
