import type { WorkspaceSurface } from '../../domain/entities/workspaceSurface';
import { useAppStore } from '../../store/useAppStore';

export function useWorkspaceNavigation() {
  const setActiveView = useAppStore((state) => state.setActiveView);
  const createThread = useAppStore((state) => state.createThread);
  const switchThread = useAppStore((state) => state.switchThread);
  const isTaskSwitchLocked = useAppStore((state) => Boolean(state.activeRequestId));

  const openSurface = (surface: WorkspaceSurface) => setActiveView(surface);

  const openTask = (threadId: string) => {
    if (isTaskSwitchLocked) return;
    switchThread(threadId);
    setActiveView('tasks');
  };

  const createTask = (sideTask = false) => {
    if (isTaskSwitchLocked) return;
    const threadId = createThread(sideTask ? 'Tác vụ song song' : 'Tác vụ mới');
    openTask(threadId);
  };

  return { openSurface, openTask, createTask, isTaskSwitchLocked };
}
