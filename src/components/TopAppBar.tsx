import type { CSSProperties } from 'react';
import { useAppUpdate } from '../application/hooks/useAppUpdate';
import { useGitStatus } from '../application/hooks/useGitStatus';
import { useWindowControls } from '../application/hooks/useWindowControls';
import { useAppStore } from '../store/useAppStore';
import { WorkspaceTabBar } from './workspace/WorkspaceTabBar';
import type { AgentControlSnapshot } from '../application/services/agentControlCenter';

type ElectronDragStyle = CSSProperties & { WebkitAppRegion: 'drag' | 'no-drag' };

const dragStyle = { WebkitAppRegion: 'drag' } as ElectronDragStyle;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as ElectronDragStyle;

export function TopAppBar({ agentMetrics }: { agentMetrics: AgentControlSnapshot['metrics'] }) {
  const projectPath = useAppStore((state) => state.projectPath);
  const currentBranch = useAppStore((state) => state.currentBranch);
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  const isUtilityDockOpen = useAppStore((state) => state.isUtilityDockOpen);
  const toggleUtilityDock = useAppStore((state) => state.toggleUtilityDock);
  useGitStatus();
  const { update, download, install } = useAppUpdate();
  const { selectWorkspace } = useWindowControls();

  const handleSelectWorkspace = async () => {
    try {
      await selectWorkspace();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Không chọn được repository.');
    }
  };

  return (
    <header className="flex h-10 shrink-0 items-stretch border-b border-black/[0.08] bg-[#f5f5f5]" style={dragStyle}>
      {!isSidebarOpen && (
        <button type="button" onClick={() => setSidebarOpen(true)} className="flex w-10 shrink-0 items-center justify-center text-[#777] hover:bg-black/[0.04]" style={noDragStyle} title="Mở thanh bên">
          <span className="material-symbols-outlined text-[17px]">left_panel_open</span>
        </button>
      )}
      <WorkspaceTabBar />
      <div className="ml-auto flex shrink-0 items-center gap-1 px-2" style={noDragStyle}>
        {update.status === 'available' && (
          <button type="button" onClick={() => void download()} className="rounded-md bg-[#242424] px-2 py-1 text-[10px] font-medium text-white">Cập nhật {update.version}</button>
        )}
        {update.status === 'downloading' && <span className="px-2 text-[10px] text-[#777]">Đang tải {update.progress ?? 0}%</span>}
        {update.status === 'downloaded' && (
          <button type="button" onClick={() => void install()} className="rounded-md bg-[#242424] px-2 py-1 text-[10px] font-medium text-white">Khởi động lại</button>
        )}
        <button type="button" onClick={handleSelectWorkspace} className="flex h-7 max-w-[190px] items-center gap-1.5 rounded-md px-2 text-[11px] text-[#666] hover:bg-black/[0.05]" title={projectPath ?? 'Chọn workspace'}>
          <span className="material-symbols-outlined text-[15px]">folder</span>
          <span className="max-w-[110px] truncate">{basename(projectPath) || 'Mở'}</span>
          <span className="material-symbols-outlined text-[13px]">expand_more</span>
        </button>
        {currentBranch && (
          <span className="hidden max-w-[105px] items-center gap-1 truncate rounded-md px-2 py-1 font-mono text-[10px] text-[#777] min-[1180px]:flex">
            <span className="material-symbols-outlined text-[13px]">account_tree</span>{currentBranch}
          </span>
        )}
        <button type="button" onClick={toggleUtilityDock} className={`relative flex h-7 w-7 items-center justify-center rounded-md ${isUtilityDockOpen ? 'bg-black/[0.07] text-[#222]' : 'text-[#777] hover:bg-black/[0.05]'}`} title={isUtilityDockOpen ? 'Thu gọn hoạt động và công cụ' : 'Mở hoạt động và công cụ'} aria-label={isUtilityDockOpen ? 'Thu gọn cánh phải' : 'Mở cánh phải'}>
          <span className="material-symbols-outlined text-[16px]">{isUtilityDockOpen ? 'right_panel_close' : 'right_panel_open'}</span>
          {agentMetrics.attention > 0 ? <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-[#f5f5f5]" /> : agentMetrics.working > 0 ? <span className="absolute right-0 top-0 h-2 w-2 animate-pulse rounded-full bg-green-600 ring-2 ring-[#f5f5f5]" /> : null}
        </button>
      </div>
    </header>
  );
}

function basename(filePath: string | null): string {
  return filePath?.split(/[\\/]/).filter(Boolean).pop() ?? '';
}
