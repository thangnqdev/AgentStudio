import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { createHash } from 'node:crypto';
import { settingsRepo } from './JsonSettingsRepository.js';
import { resolveSafePath } from './security/resolveSafePath.js';

type ChatHistoryPayload = {
  workspacePath?: string;
  threads?: unknown[];
  activeThreadId?: string | null;
};

export class WorkspaceManager {
  async getWorkspaceRoot() {
    const settings = await settingsRepo.loadStoredSettings();
    return settings.workspacePath || process.cwd();
  }

  async resolveWorkspacePath(inputPath: string) {
    const workspaceRoot = await this.getWorkspaceRoot();
    return resolveSafePath(inputPath, workspaceRoot);
  }

  getChatHistoryDir() {
    return path.join(app.getPath('userData'), 'chat-history');
  }

  getChatHistoryPath(workspacePath: string) {
    const normalizedPath = path.resolve(workspacePath || process.cwd());
    const hash = createHash('sha256').update(normalizedPath).digest('hex').slice(0, 24);
    return path.join(this.getChatHistoryDir(), `${hash}.json`);
  }

  async loadWorkspaceChatHistory(workspacePath: string) {
    try {
      const raw = await fs.readFile(this.getChatHistoryPath(workspacePath), 'utf8');
      const parsed = JSON.parse(raw) as ChatHistoryPayload;
      return {
        threads: Array.isArray(parsed.threads) ? parsed.threads : [],
        activeThreadId: typeof parsed.activeThreadId === 'string' ? parsed.activeThreadId : null,
      };
    } catch {
      return {
        threads: [],
        activeThreadId: null,
      };
    }
  }

  async saveWorkspaceChatHistory(payload: ChatHistoryPayload) {
    const workspacePath = (typeof payload.workspacePath === 'string' ? payload.workspacePath : '') || await this.getWorkspaceRoot();
    const history = {
      threads: Array.isArray(payload.threads) ? payload.threads : [],
      activeThreadId: typeof payload.activeThreadId === 'string' ? payload.activeThreadId : null,
      savedAt: new Date().toISOString(),
      workspacePath,
    };

    await fs.mkdir(this.getChatHistoryDir(), { recursive: true });
    await fs.writeFile(this.getChatHistoryPath(workspacePath), JSON.stringify(history), 'utf8');
    return { ok: true };
  }
}

export const workspaceManager = new WorkspaceManager();
