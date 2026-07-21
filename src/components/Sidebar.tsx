import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAppVersion } from '../application/hooks/useAppVersion';
import { useSidebarResize } from '../application/hooks/useSidebarResize';
import { useWorkspaceNavigation } from '../application/hooks/useWorkspaceNavigation';
import type { WorkspaceSurface } from '../domain/entities/workspaceSurface';
import { useAppStore } from '../store/useAppStore';
import { MacTrafficLights } from './MacTrafficLights';
import { SidebarProjectExplorer } from './sidebar/SidebarProjectExplorer';

type SidebarItem = { surface: WorkspaceSurface; label: string; icon: string };

const PRIMARY_ITEMS: SidebarItem[] = [
  { surface: 'knowledge', label: 'Cơ sở tri thức', icon: 'menu_book' },
  { surface: 'evaluations', label: 'Đánh giá agent', icon: 'fact_check' },
  { surface: 'workflows', label: 'Tự động hóa', icon: 'account_tree' },
  { surface: 'capabilities', label: 'Công cụ & kết nối', icon: 'extension' },
];

const TOOL_ITEMS: SidebarItem[] = [
  { surface: 'observability', label: 'Lịch sử hoạt động', icon: 'monitoring' },
  { surface: 'optimizer', label: 'Tối ưu an toàn', icon: 'tune' },
  { surface: 'skill-learning', label: 'Kỹ năng đã học', icon: 'school' },
  { surface: 'agents', label: 'Hồ sơ agent', icon: 'smart_toy' },
];

const dragStyle = { WebkitAppRegion: 'drag' } as CSSProperties;

export function Sidebar() {
  const appVersion = useAppVersion();
  const activeView = useAppStore((state) => state.activeView);
  const isSidebarOpen = useAppStore((state) => state.isSidebarOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  const sidebarWidth = useAppStore((state) => state.sidebarWidth);
  const setSidebarWidth = useAppStore((state) => state.setSidebarWidth);
  const { createTask, openSurface, isTaskSwitchLocked } = useWorkspaceNavigation();
  const { resize, isResizing } = useSidebarResize(sidebarWidth, setSidebarWidth);

  // Controlled dropdown "Công cụ khác" với click-outside để đóng
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toolsOpen) return;
    const close = (e: MouseEvent) => {
      if (!toolsRef.current?.contains(e.target as Node)) setToolsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [toolsOpen]);

  return (
    <nav className={`relative flex h-full shrink-0 flex-col overflow-hidden bg-sidebar ${isResizing ? '' : 'transition-[width] duration-200'} ${isSidebarOpen ? 'border-r border-outline-variant/60' : 'border-r-0'}`} style={{ width: isSidebarOpen ? `min(38vw, ${sidebarWidth}px)` : 0 }}>
      {isSidebarOpen && <div onPointerDown={resize} className="absolute inset-y-0 right-0 z-40 w-1 cursor-col-resize hover:bg-secondary/30" aria-hidden="true" />}
      <div className="flex h-9 shrink-0 items-center" style={dragStyle}><MacTrafficLights /></div>
      <div className="flex items-center px-3 pb-2">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left hover:bg-interactive-hover">
          <span className="truncate text-[13px] font-semibold text-on-surface">AgentStudio</span>
          <span className="material-symbols-outlined text-[13px] text-on-surface-variant">expand_more</span>
        </button>
        <button type="button" onClick={() => setSidebarOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-variant hover:bg-interactive-hover" title="Đóng thanh bên">
          <span className="material-symbols-outlined text-[16px]">left_panel_close</span>
        </button>
      </div>

      <div className="px-2">
        <SidebarButton
          label="Tác vụ mới"
          icon="edit_square"
          onClick={() => createTask()}
          disabled={isTaskSwitchLocked}
          title={isTaskSwitchLocked ? 'Hãy đợi hoặc dừng agent trước khi đổi tác vụ' : undefined}
        />
        {PRIMARY_ITEMS.map((item) => <SidebarNavItem key={item.surface} item={item} active={activeView === item.surface} onOpen={openSurface} />)}
      </div>

      <div className="mt-5 flex min-h-0 flex-1 overflow-hidden"><SidebarProjectExplorer /></div>

      <div className="border-t border-outline-variant/60 px-2 py-2">
        {/* Controlled dropdown thay thế <details> — hỗ trợ click-outside để đóng */}
        <div ref={toolsRef} className="mb-1">
          <button
            type="button"
            onClick={() => setToolsOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-on-surface-variant hover:bg-interactive-hover"
          >
            <span className="material-symbols-outlined text-[15px]">more_horiz</span>
            <span className="flex-1 text-left">Công cụ khác</span>
            <span className="material-symbols-outlined text-[13px]">{toolsOpen ? 'expand_less' : 'expand_more'}</span>
          </button>
          {toolsOpen && (
            <div className="pb-1 pl-2">
              {TOOL_ITEMS.map((item) => (
                <SidebarNavItem
                  key={item.surface}
                  item={item}
                  active={activeView === item.surface}
                  onOpen={(surface) => { setToolsOpen(false); openSurface(surface); }}
                />
              ))}
            </div>
          )}
        </div>
        <SidebarButton label="Cài đặt" icon="settings" active={activeView === 'settings'} onClick={() => openSurface('settings')} />
        <div className="flex items-center justify-between px-2 pt-2 text-[9px] text-on-surface-variant"><span>AgentStudio</span><span>{appVersion ? `v${appVersion}` : ''}</span></div>
      </div>
    </nav>
  );
}

function SidebarNavItem({ item, active, onOpen }: { item: SidebarItem; active: boolean; onOpen: (surface: WorkspaceSurface) => void }) {
  return <SidebarButton label={item.label} icon={item.icon} active={active} onClick={() => onOpen(item.surface)} />;
}

function SidebarButton({ label, icon, active = false, disabled = false, title, onClick }: { label: string; icon: string; active?: boolean; disabled?: boolean; title?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[11px] disabled:cursor-not-allowed disabled:opacity-45 ${active ? 'bg-interactive-selected font-medium text-on-surface' : 'text-on-surface-variant hover:bg-interactive-hover disabled:hover:bg-transparent'}`}>
      <span className="material-symbols-outlined text-[15px]">{icon}</span><span className="truncate">{label}</span>
    </button>
  );
}
