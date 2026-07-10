import { ipcMain } from 'electron';
import { runAgentSession, type AgentStartPayload } from '../agentRuntime.js';
import { settingsRepo } from '../infrastructure/JsonSettingsRepository.js';
import { workspaceManager } from '../infrastructure/WorkspaceManager.js';
import { knowledgeBaseUseCase } from '../knowledgeRuntime.js';

const activeAgentControllers = new Map<string, AbortController>();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function registerAgentIpc() {
  ipcMain.on('ai:chat:stop', (_event, rawPayload: { requestId?: string }) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const requestId = getString(payload.requestId);
    activeAgentControllers.get(requestId)?.abort();
  });

  ipcMain.on('ai:chat:start', async (event, rawPayload: AgentStartPayload) => {
    const payload = isObject(rawPayload) ? rawPayload : {};
    const requestId = getString(payload.requestId);

    if (!requestId) {
      event.sender.send('ai:chat:error', { requestId: '', error: 'Thiếu requestId.' });
      return;
    }

    try {
      const controller = new AbortController();
      activeAgentControllers.set(requestId, controller);
      const settings = await settingsRepo.loadStoredSettings();
      const activeProvider = settings.providers.find((provider) => provider.id === settings.activeProviderId);
      if (!activeProvider) {
        throw new Error('Chưa cấu hình provider AI.');
      }

      const workspaceRoot = await workspaceManager.getWorkspaceRoot();
      const latestUserMessage = [...(payload.messages ?? [])].reverse().find((message) => message.sender === 'user');
      const knowledgeContext = latestUserMessage?.content
        ? await knowledgeBaseUseCase.buildContext(workspaceRoot, latestUserMessage.content)
        : '';

      await runAgentSession(payload, event.sender, {
        baseUrl: activeProvider.baseUrl,
        apiKey: settingsRepo.decryptApiKey(activeProvider),
        model: settings.activeModelId || '',
        contextWindow: activeProvider.models.find(m => m.id === settings.activeModelId)?.contextWindow,
        permissionMode: settings.permissionMode,
      }, workspaceRoot, knowledgeContext, controller.signal);
    } catch (error) {
      if (activeAgentControllers.get(requestId)?.signal.aborted) {
        event.sender.send('ai:chat:chunk', { requestId, chunk: '\n\nĐã dừng phản hồi.' });
        event.sender.send('ai:chat:done', { requestId });
      } else {
        event.sender.send('ai:chat:error', {
          requestId,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    } finally {
      activeAgentControllers.delete(requestId);
    }
  });
}
