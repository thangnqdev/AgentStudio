import type { WorkspaceProjectSummary } from '../../domain/entities/workspaceProject.js';
import type { ISettingsRepository } from '../../domain/ports/ISettingsRepository.js';
import type { IWorkspaceHistoryReader } from '../../domain/ports/IWorkspaceHistoryReader.js';
import { parseChatHistoryInput } from '../services/chatHistoryInput.js';
import {
  normalizeRecentWorkspacePaths,
  normalizeWorkspacePath,
  rememberWorkspacePath,
  requireWorkspacePath,
} from '../services/workspaceSelection.js';

export class ManageWorkspaceProjects {
  private readonly settingsRepository: ISettingsRepository;
  private readonly histories: IWorkspaceHistoryReader;
  private readonly stopActiveWorkspace: () => Promise<unknown>;

  constructor(
    settingsRepository: ISettingsRepository,
    histories: IWorkspaceHistoryReader,
    stopActiveWorkspace: () => Promise<unknown>,
  ) {
    this.settingsRepository = settingsRepository;
    this.histories = histories;
    this.stopActiveWorkspace = stopActiveWorkspace;
  }

  async list(): Promise<WorkspaceProjectSummary[]> {
    const settings = await this.settingsRepository.loadStoredSettings();
    const paths = normalizeRecentWorkspacePaths([settings.workspacePath, ...(settings.recentWorkspacePaths ?? [])]);
    return Promise.all(paths.map(async (workspacePath) => {
      try {
        const history = parseChatHistoryInput(await this.histories.loadWorkspaceChatHistory(workspacePath));
        return projectSummary(workspacePath, history);
      } catch {
        return projectSummary(workspacePath, { threads: [], activeThreadId: null });
      }
    }));
  }

  async select(workspacePath: unknown) {
    return this.activate(workspacePath, true);
  }

  async activate(workspacePath: unknown, allowNew = false) {
    const selectedPath = requireWorkspacePath(workspacePath);
    const settings = await this.settingsRepository.loadStoredSettings();
    const recent = normalizeRecentWorkspacePaths([settings.workspacePath, ...(settings.recentWorkspacePaths ?? [])]);
    if (!allowNew && !includesPath(recent, selectedPath)) throw new Error('Dự án chưa được người dùng thêm vào danh sách gần đây.');
    await this.stopActiveWorkspace();
    settings.workspacePath = selectedPath;
    settings.recentWorkspacePaths = rememberWorkspacePath(recent, selectedPath);
    await this.settingsRepository.saveStoredSettings(settings);
    return { path: selectedPath, recentWorkspacePaths: settings.recentWorkspacePaths };
  }

  async remove(workspacePath: unknown) {
    const target = requireWorkspacePath(workspacePath);
    const settings = await this.settingsRepository.loadStoredSettings();
    if (samePath(settings.workspacePath, target)) throw new Error('Không thể ẩn dự án đang hoạt động.');
    settings.recentWorkspacePaths = (settings.recentWorkspacePaths ?? []).filter((item) => !samePath(item, target));
    await this.settingsRepository.saveStoredSettings(settings);
    return this.list();
  }
}

function projectSummary(
  workspacePath: string,
  history: ReturnType<typeof parseChatHistoryInput>,
): WorkspaceProjectSummary {
  const threads = [...history.threads]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((thread) => ({ id: thread.id, title: thread.title, updatedAt: thread.updatedAt }));
  return {
    path: workspacePath,
    name: workspaceName(workspacePath),
    activeThreadId: history.activeThreadId,
    threads,
  };
}

function workspaceName(workspacePath: string) {
  return normalizeWorkspacePath(workspacePath).split(/[\\/]/).filter(Boolean).pop() ?? workspacePath;
}

function includesPath(paths: readonly string[], target: string) {
  return paths.some((item) => samePath(item, target));
}

function samePath(left: string, right: string) {
  return process.platform === 'win32'
    ? left.toLocaleLowerCase() === right.toLocaleLowerCase()
    : left === right;
}
