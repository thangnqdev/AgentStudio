import { describe, expect, it, vi } from 'vitest';
import type { StoredSettings } from '../../domain/entities/settings.js';
import type { ISettingsRepository } from '../../domain/ports/ISettingsRepository.js';
import { ManageWorkspaceProjects } from './ManageWorkspaceProjects.js';

const baseSettings = (): StoredSettings => ({
  providers: [],
  activeProviderId: null,
  activeModelId: null,
  fallbackModelId: null,
  permissionMode: 'workspace-write',
  workspacePath: 'D:\\Current',
  recentWorkspacePaths: ['D:\\Current', 'D:\\Other'],
  themePreference: 'system',
});

function repository(settings: StoredSettings): ISettingsRepository {
  return {
    loadStoredSettings: vi.fn(async () => structuredClone(settings)),
    saveStoredSettings: vi.fn(async (next) => { Object.assign(settings, structuredClone(next)); }),
    encryptApiKey: vi.fn(() => ({})),
    decryptApiKey: vi.fn(() => ''),
  };
}

describe('ManageWorkspaceProjects', () => {
  it('projects recent workspaces with their chat titles', async () => {
    const settings = baseSettings();
    const manager = new ManageWorkspaceProjects(repository(settings), {
      loadWorkspaceChatHistory: vi.fn(async (workspacePath) => ({
        activeThreadId: 'thread-1',
        threads: [{
          id: 'thread-1', title: `Chat ${workspacePath}`, messages: [],
          createdAt: '2026-07-21T00:00:00.000Z', updatedAt: '2026-07-21T01:00:00.000Z',
        }],
      })),
    }, vi.fn(async () => undefined));

    const projects = await manager.list();

    expect(projects.map((project) => project.name)).toEqual(['Current', 'Other']);
    expect(projects[1]?.threads[0]?.title).toBe('Chat D:\\Other');
  });

  it('only activates a known recent workspace unless it came from the picker', async () => {
    const settings = baseSettings();
    const stop = vi.fn(async () => undefined);
    const manager = new ManageWorkspaceProjects(repository(settings), {
      loadWorkspaceChatHistory: vi.fn(async () => ({ threads: [], activeThreadId: null })),
    }, stop);

    await expect(manager.activate('D:\\Unknown')).rejects.toThrow('chưa được người dùng thêm');
    await manager.select('D:\\Unknown');

    expect(settings.workspacePath).toBe('D:\\Unknown');
    expect(settings.recentWorkspacePaths?.[0]).toBe('D:\\Unknown');
    expect(stop).toHaveBeenCalledOnce();
  });
});
