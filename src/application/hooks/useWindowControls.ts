import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';
import { useAppStore } from '../../store/useAppStore';

/**
 * Hook adapter cho các thao tác cửa sổ Electron (minimize, maximize, close).
 * Tách biệt component ra khỏi AgentBridge — đúng theo Clean Architecture.
 */
export function useWindowControls() {
  const setProjectPath = useAppStore((s) => s.setProjectPath);
  const setSettings = useAppStore((s) => s.setSettings);

  const platform = AgentBridge.isAvailable ? AgentBridge.getPlatform() : (
    typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac') ? 'darwin' : 'other'
  );

  const closeWindow = () => {
    if (AgentBridge.isAvailable) AgentBridge.closeWindow();
  };

  const minimizeWindow = () => {
    if (AgentBridge.isAvailable) AgentBridge.minimizeWindow();
  };

  const maximizeWindow = () => {
    if (AgentBridge.isAvailable) AgentBridge.maximizeWindow();
  };

  const selectWorkspace = async (): Promise<{ canceled: boolean; path: string } | null> => {
    if (!AgentBridge.isAvailable) throw new Error('Electron bridge is not available.');
    const workspace = await AgentBridge.selectWorkspace();
    if (workspace.canceled) return { canceled: true, path: '' };

    // Persist current chat history before switching workspace
    const currentState = useAppStore.getState();
    if (currentState.settings.workspacePath && currentState.settings.workspacePath !== 'chưa có dự án') {
      await AgentBridge.saveChatHistory({
        workspacePath: currentState.settings.workspacePath,
        threads: currentState.threads,
        activeThreadId: currentState.activeThreadId,
      });
    }

    setProjectPath(workspace.path);
    setSettings({ workspacePath: workspace.path });
    return { canceled: false, path: workspace.path };
  };

  return { platform, closeWindow, minimizeWindow, maximizeWindow, selectWorkspace };
}
