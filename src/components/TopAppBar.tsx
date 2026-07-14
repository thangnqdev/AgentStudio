import { type CSSProperties } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useGitStatus } from '../application/hooks/useGitStatus';
import { useAppUpdate } from '../application/hooks/useAppUpdate';
import { useWindowControls } from '../application/hooks/useWindowControls';

type ElectronDragStyle = CSSProperties & {
  WebkitAppRegion: 'drag' | 'no-drag';
};

const dragStyle = { WebkitAppRegion: 'drag' } as ElectronDragStyle;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as ElectronDragStyle;

import { MacTrafficLights } from './MacTrafficLights';

export function TopAppBar() {
  const projectPath = useAppStore((s) => s.projectPath);
  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const isTerminalOpen = useAppStore((s) => s.isTerminalOpen);
  const setTerminalOpen = useAppStore((s) => s.setTerminalOpen);
  const currentBranch = useAppStore((s) => s.currentBranch);


  useGitStatus();
  const { update, download, install } = useAppUpdate();
  const { platform, selectWorkspace } = useWindowControls();

  const isMac = platform === 'darwin';

  const handleSelectWorkspace = async () => {
    try {
      await selectWorkspace();
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
        {currentBranch ? (
          <>
            <span className="text-outline-variant px-1">/</span>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface border border-outline-variant text-on-surface-variant font-code-base text-[12px]">
              <span className="material-symbols-outlined text-[14px]">call_split</span>
              {currentBranch}
            </div>
          </>
        ) : (
          <>
            <span className="text-outline-variant px-1">/</span>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface border border-outline-variant text-on-surface-variant/50 font-code-base text-[12px]">
              <span className="material-symbols-outlined text-[14px]">call_split</span>
              không có git
            </div>
          </>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1" style={noDragStyle}>
        {update.status === 'available' && (
          <button
            onClick={() => void download()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-on-primary hover:opacity-90 transition-opacity font-ui-label-bold text-[12px]"
            title={`Tải bản cập nhật ${update.version ?? ''}`}
          >
            <span className="material-symbols-outlined text-[16px]">system_update</span>
            Cập nhật {update.version ?? ''}
          </button>
        )}
        {update.status === 'downloading' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container-highest text-on-surface-variant font-ui-label-bold text-[12px]">
            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            Đang tải {update.progress ?? 0}%
          </div>
        )}
        {update.status === 'downloaded' && (
          <button
            onClick={() => void install()}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary text-on-primary hover:opacity-90 transition-opacity font-ui-label-bold text-[12px]"
            title="Khởi động lại để cài bản cập nhật"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            Cài & khởi động lại
          </button>
        )}
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
