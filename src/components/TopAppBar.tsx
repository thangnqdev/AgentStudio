import type { CSSProperties } from 'react';
import { useAppStore } from '../store/useAppStore';

type ElectronDragStyle = CSSProperties & {
  WebkitAppRegion: 'drag' | 'no-drag';
};

const dragStyle = { WebkitAppRegion: 'drag' } as ElectronDragStyle;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as ElectronDragStyle;

export function TopAppBar() {
  const projectPath = useAppStore((s) => s.projectPath);
  const setProjectPath = useAppStore((s) => s.setProjectPath);
  const setSettings = useAppStore((s) => s.setSettings);

  const handleSelectWorkspace = async () => {
    try {
      if (!window.agentStudio) throw new Error('Electron bridge is not available.');
      const workspace = await window.agentStudio.selectWorkspace();
      if (workspace.canceled) return;
      const currentState = useAppStore.getState();
      if (currentState.settings.workspacePath && currentState.settings.workspacePath !== 'chưa có dự án') {
        await window.agentStudio.saveChatHistory({
          workspacePath: currentState.settings.workspacePath,
          threads: currentState.threads,
          activeThreadId: currentState.activeThreadId,
        });
      }
      setProjectPath(workspace.path);
      setSettings({ workspacePath: workspace.path });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Không chọn được repository.');
    }
  };

  return (
    <header 
      className="flex justify-between items-center px-6 w-full h-[52px] border-b border-outline-variant bg-surface-dim shrink-0 z-10"
      style={dragStyle}
    >
      {/* Left: Branch/Project Context */}
      <div className="flex items-center gap-3" style={noDragStyle}>
        <span className="font-ui-label-bold text-ui-label-bold text-primary">
          {projectPath ?? 'chưa có dự án'}
        </span>
        <span className="text-outline-variant">/</span>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface border border-outline-variant text-on-surface-variant font-code-base text-code-base">
          <span className="material-symbols-outlined text-[14px]">call_split</span>
          feature/agent-runtime
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1" style={noDragStyle}>
        <button
          onClick={handleSelectWorkspace}
          className="p-1.5 rounded hover:bg-surface-container-highest transition-colors text-on-surface-variant"
          title="Chọn repository"
        >
          <span className="material-symbols-outlined text-[20px]">folder_open</span>
        </button>
        <button
          className="p-1.5 rounded hover:bg-surface-container-highest transition-colors text-on-surface-variant"
          title="Lịch sử"
        >
          <span className="material-symbols-outlined text-[20px]">history</span>
        </button>
        <button
          className="p-1.5 rounded hover:bg-surface-container-highest transition-colors text-on-surface-variant"
          title="Tùy chọn khác"
        >
          <span className="material-symbols-outlined text-[20px]">more_vert</span>
        </button>
      </div>
    </header>
  );
}
