import type { CSSProperties } from 'react';
import { useAppUpdate } from '../application/hooks/useAppUpdate';
import { useGitStatus } from '../application/hooks/useGitStatus';
import { useAppStore } from '../store/useAppStore';
import type { AgentControlSnapshot } from '../application/services/agentControlCenter';

type ElectronDragStyle = CSSProperties & { WebkitAppRegion: 'drag' | 'no-drag' };

const dragStyle = { WebkitAppRegion: 'drag' } as ElectronDragStyle;
const noDragStyle = { WebkitAppRegion: 'no-drag' } as ElectronDragStyle;

export function TopAppBar({ agentMetrics }: { agentMetrics: AgentControlSnapshot['metrics'] }) {
  const currentBranch = useAppStore((state) => state.currentBranch);
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  const isUtilityDockOpen = useAppStore((state) => state.isUtilityDockOpen);
  const toggleUtilityDock = useAppStore((state) => state.toggleUtilityDock);
  useGitStatus();
  const { update, download, install } = useAppUpdate();

  return (
    <header className="flex h-10 shrink-0 items-stretch border-b border-outline-variant/60 bg-toolbar" style={dragStyle}>
      {!isSidebarOpen && (
        <button type="button" onClick={() => setSidebarOpen(true)} className="flex w-10 shrink-0 items-center justify-center text-on-surface-variant hover:bg-interactive-hover" style={noDragStyle} title="Mở thanh bên">
          <span className="material-symbols-outlined text-[17px]">left_panel_open</span>
        </button>
      )}
      <div className="min-w-0 flex-1" />
      <div className="ml-auto flex shrink-0 items-center gap-1 px-2" style={noDragStyle}>
        {update.status === 'available' && (
          <button type="button" onClick={() => void download()} className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-on-primary">Cập nhật {update.version}</button>
        )}
        {update.status === 'downloading' && <span className="px-2 text-[10px] text-on-surface-variant">Đang tải {update.progress ?? 0}%</span>}
        {update.status === 'downloaded' && (
          <button type="button" onClick={() => void install()} className="rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-on-primary">Khởi động lại</button>
        )}
        {currentBranch && (
          <span className="hidden max-w-[105px] items-center gap-1 truncate rounded-md px-2 py-1 font-mono text-[10px] text-on-surface-variant min-[1180px]:flex">
            <span className="material-symbols-outlined text-[13px]">account_tree</span>{currentBranch}
          </span>
        )}
        <button type="button" onClick={toggleUtilityDock} className={`relative flex h-7 w-7 items-center justify-center rounded-md ${isUtilityDockOpen ? 'bg-interactive-selected text-on-surface' : 'text-on-surface-variant hover:bg-interactive-hover'}`} title={isUtilityDockOpen ? 'Thu gọn hoạt động và công cụ' : 'Mở hoạt động và công cụ'} aria-label={isUtilityDockOpen ? 'Thu gọn cánh phải' : 'Mở cánh phải'}>
          <span className="material-symbols-outlined text-[16px]">{isUtilityDockOpen ? 'right_panel_close' : 'right_panel_open'}</span>
          {agentMetrics.attention > 0 ? <span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-warning ring-2 ring-toolbar" /> : agentMetrics.working > 0 ? <span className="absolute right-0 top-0 h-2 w-2 animate-pulse rounded-full bg-success ring-2 ring-toolbar" /> : null}
        </button>
      </div>
    </header>
  );
}
