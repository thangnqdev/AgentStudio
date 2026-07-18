import { ipcMain } from 'electron';
import { agentTaskService, agentToolApprovalManager, agentTraceService, agentUserInteractionManager, agentWorktreeManager, resolveAgentSessionScope, runAgentSession } from '../agentRuntime.js';
import { settingsRepo } from '../infrastructure/JsonSettingsRepository.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';
import { knowledgeBaseUseCase } from '../knowledgeRuntime.js';
import { skillManager } from '../skillRuntime.js';
import { PrepareAgentSession } from '../application/usecases/PrepareAgentSession.js';
import { optimizerRepository, safeOptimizer } from '../optimizerRuntime.js';
import { parseAgentStartPayload } from '../application/services/agentStartPayloadValidation.js';
import { buildAgentProviderSettings } from '../application/services/buildAgentProviderSettings.js';
import { FileSystemProjectInstructionLoader } from '../infrastructure/instructions/FileSystemProjectInstructionLoader.js';
import { lifecycleHookDispatcher } from '../hookRuntime.js';
import { parseAgentInteractionResponse } from '../application/services/agentInteractionResponseValidation.js';
import { attachmentAuthorizations } from '../attachmentRuntime.js';

const activeAgentControllers = new Map<string, AbortController>();
const activeAgentTaskIds = new Map<string, string>();
let interruptedTaskRecovery: Promise<void> | null = null;
const prepareAgentSession = new PrepareAgentSession(
  agentTaskService,
  knowledgeBaseUseCase,
  skillManager,
  agentTraceService,
  optimizerRepository,
  new FileSystemProjectInstructionLoader(),
  lifecycleHookDispatcher,
);

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
    agentUserInteractionManager.cancelRequest(requestId);
  });

  ipcMain.on('ai:chat:tool-approval', (_event, rawPayload: unknown) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const requestId = getString(payload.requestId);
    const actionId = getString(payload.actionId);
    if (!requestId || !actionId) return;
    agentToolApprovalManager.respond(requestId, actionId, getBoolean(payload.approved), getBoolean(payload.rememberDomain));
  });

  ipcMain.on('ai:chat:interaction-response', (_event, rawPayload: unknown) => {
    const parsed = parseAgentInteractionResponse(rawPayload);
    if (!parsed) return;
    agentUserInteractionManager.respond(parsed.requestId, parsed.interactionId, parsed.response);
  });

  ipcMain.on('ai:chat:start', async (event, rawPayload: unknown) => {
    const parsedPayload = parseAgentStartPayload(rawPayload);
    const requestId = getString(parsedPayload.requestId);
    const taskId = getString(parsedPayload.taskId);

    if (!requestId) {
      event.sender.send('ai:chat:error', { requestId: '', error: 'Thiếu requestId.' });
      return;
    }

    try {
      const payload = await attachmentAuthorizations.resolvePayload(parsedPayload);
      await interruptedTaskRecovery;
      const controller = new AbortController();
      activeAgentControllers.set(requestId, controller);
      const settings = await settingsRepo.loadStoredSettings();
      const activeProvider = settings.providers.find((provider) => provider.id === settings.activeProviderId);
      if (!activeProvider) {
        throw new Error('Chưa cấu hình provider AI.');
      }

      const workspaceRoot = await workspaceManager.getWorkspaceRoot();
      const worktreeScopeId = resolveAgentSessionScope(payload, requestId);
      await agentWorktreeManager.restore(worktreeScopeId, workspaceRoot);
      const runtimeWorkspaceRoot = agentWorktreeManager.currentRoot(worktreeScopeId, workspaceRoot);
      const tuning = (await safeOptimizer.getState()).active;
      const { task, skillContext, projectInstructionContext, lifecycleHookContext } = await prepareAgentSession.execute({ payload, taskId, requestId, workspaceRoot, runtimeWorkspaceRoot });
      activeAgentTaskIds.set(requestId, task.id);

      const providerSettings = buildAgentProviderSettings({
        settings,
        provider: activeProvider,
        tuning,
        apiKey: settingsRepo.decryptApiKey(activeProvider),
      });
      await runAgentSession(payload, event.sender, providerSettings, workspaceRoot, task.knowledgeContext, [projectInstructionContext, lifecycleHookContext, skillContext].filter(Boolean).join('\n\n'), controller.signal, task, tuning);
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
      agentUserInteractionManager.cancelRequest(requestId);
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
