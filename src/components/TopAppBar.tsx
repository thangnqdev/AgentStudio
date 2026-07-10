import type { CSSProperties } from 'react';
import { useAppStore } from '../store/useAppStore';

type ElectronDragStyle = CSSProperties & {
  WebkitAppRegion: 'drag' | 'no-drag';
};

const dragStyle = { WebkitAppRegion: 'drag' } as ElectronDragStyle;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as ElectronDragStyle;

import { MacTrafficLights } from './MacTrafficLights';

export function TopAppBar() {
  const projectPath = useAppStore((s) => s.projectPath);
  const setProjectPath = useAppStore((s) => s.setProjectPath);
  const setSettings = useAppStore((s) => s.setSettings);
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const isTerminalOpen = useAppStore((s) => s.isTerminalOpen);
  const setTerminalOpen = useAppStore((s) => s.setTerminalOpen);

  const isMac = window.agentStudio?.getPlatform
    ? window.agentStudio.getPlatform() === 'darwin'
    : window.navigator.userAgent.toLowerCase().includes('mac');

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
      className="flex justify-between items-center px-6 w-full h-[52px] border-b border-outline-variant bg-surface-dim shrink-0 transition-all duration-200"
      style={dragStyle}
    >
      {/* Left: Branch/Project Context */}
      <div className="flex items-center gap-2" style={noDragStyle}>
        <div className="-ml-6 h-full flex items-center">
          <MacTrafficLights />
        </div>

        {isMac && (
          <div className="w-16 h-full shrink-0" style={dragStyle}></div>
        )}

        <button
          onClick={() => setSidebarOpen(!isSidebarOpen)}
          className="p-1.5 rounded hover:bg-surface-container-highest transition-colors text-on-surface-variant flex items-center justify-center mr-1"
          title={isSidebarOpen ? "Đóng Menu" : "Mở Menu"}
        >
          <span className="material-symbols-outlined text-[20px]">
            {isSidebarOpen ? 'menu_open' : 'menu'}
          </span>
        </button>

        <button
          onClick={handleSelectWorkspace}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface border border-outline-variant text-on-surface hover:bg-surface-container-highest transition-colors font-ui-label-bold text-[12px]"
          title="Chọn repository"
        >
          <span className="material-symbols-outlined text-[14px]">folder</span>
          {projectPath ?? 'chưa có dự án'}
        </button>
        <span className="text-outline-variant px-1">/</span>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface border border-outline-variant text-on-surface-variant font-code-base text-[12px]">
          <span className="material-symbols-outlined text-[14px]">call_split</span>
          feature/agent-runtime
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1" style={noDragStyle}>
        <button
          onClick={() => setTerminalOpen(!isTerminalOpen)}
          className={`p-1.5 rounded hover:bg-surface-container-highest transition-colors flex items-center justify-center ${
            isTerminalOpen ? 'bg-surface-container-highest text-primary' : 'text-on-surface-variant'
          }`}
          title={isTerminalOpen ? "Đóng trình lệnh" : "Mở trình lệnh"}
        >
          <span className="material-symbols-outlined text-[20px]">terminal</span>
        </button>
      </div>
    </header>
  );
}
