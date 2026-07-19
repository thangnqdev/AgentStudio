import { useAppStore } from '../../store/useAppStore';
import type { WorkspaceSurface } from '../../domain/entities/workspaceTab';
import { workspaceSurfaceTitle } from '../services/workspaceTabs';

export function useWorkspaceTabs() {
  const tabs = useAppStore((state) => state.workspaceTabs);
  const activeTabId = useAppStore((state) => state.activeWorkspaceTabId);
  const openRaw = useAppStore((state) => state.openWorkspaceTab);
  const activateRaw = useAppStore((state) => state.activateWorkspaceTab);
  const closeRaw = useAppStore((state) => state.closeWorkspaceTab);
  const createThread = useAppStore((state) => state.createThread);
  const switchThread = useAppStore((state) => state.switchThread);

  const openSurface = (surface: WorkspaceSurface, forceNew = false) => openRaw({
    surface,
    title: workspaceSurfaceTitle(surface),
    reuseKey: forceNew ? undefined : surface,
  });

  const openTask = (threadId: string, title: string, sideTask = false) => {
    switchThread(threadId);
    return openRaw({
      surface: 'tasks', title, threadId, sideTask,
      reuseKey: `tasks:${threadId}`,
    });
  };

  const createTask = (sideTask = false) => {
    const title = sideTask ? 'Tác vụ song song' : 'Tác vụ mới';
    const threadId = createThread(title);
    return openTask(threadId, title, sideTask);
  };

  const activate = (tabId: string) => {
    const tab = tabs.find((candidate) => candidate.id === tabId);
    if (tab?.surface === 'tasks' && tab.threadId) switchThread(tab.threadId);
    activateRaw(tabId);
  };

  const close = (tabId: string) => {
    const nextId = closeRaw(tabId);
    const nextTab = useAppStore.getState().workspaceTabs.find((candidate) => candidate.id === nextId);
    if (nextTab?.surface === 'tasks' && nextTab.threadId) switchThread(nextTab.threadId);
  };

  return { tabs, activeTabId, openSurface, openTask, createTask, activate, close };
}
