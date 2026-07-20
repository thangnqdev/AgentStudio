import type { CSSProperties } from 'react';
import { useAppVersion } from '../application/hooks/useAppVersion';
import { useWorkspaceTabs } from '../application/hooks/useWorkspaceTabs';
import type { WorkspaceSurface } from '../domain/entities/workspaceTab';
import { useAppStore } from '../store/useAppStore';
import { MacTrafficLights } from './MacTrafficLights';

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
  const projectPath = useAppStore((state) => state.projectPath);
  const threads = useAppStore((state) => state.threads);
  const activeThreadId = useAppStore((state) => state.activeThreadId);
  const deleteThread = useAppStore((state) => state.deleteThread);
  const { createTask, openSurface, openTask } = useWorkspaceTabs();

  return (
    <nav className={`flex h-full shrink-0 flex-col overflow-hidden border-r border-outline-variant/60 bg-sidebar transition-[width] duration-200 ${isSidebarOpen ? 'w-[264px]' : 'w-0 border-r-0'}`}>
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
        <SidebarButton label="Tác vụ mới" icon="edit_square" onClick={() => createTask()} />
        {PRIMARY_ITEMS.map((item) => <SidebarNavItem key={item.surface} item={item} active={activeView === item.surface} onOpen={openSurface} />)}
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-3 text-[10px] font-medium text-on-surface-variant">
          <span>Dự án</span>
          <button type="button" onClick={() => createTask()} className="flex h-5 w-5 items-center justify-center rounded hover:bg-interactive-hover" title="Tác vụ mới"><span className="material-symbols-outlined text-[14px]">add</span></button>
        </div>
        <div className="mt-2 flex items-center gap-2 px-3 text-[11px] font-medium text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px]">folder</span>
          <span className="truncate">{basename(projectPath) || 'Workspace'}</span>
        </div>
        <div className="mt-1 flex-1 overflow-y-auto px-2 pb-3">
          {threads.map((thread) => (
            <div key={thread.id} className="group flex items-center">
              <button type="button" onClick={() => openTask(thread.id, thread.title)} className={`min-w-0 flex-1 truncate rounded-md px-3 py-1.5 text-left text-[11px] ${thread.id === activeThreadId && activeView === 'tasks' ? 'bg-interactive-selected text-on-surface' : 'text-on-surface-variant hover:bg-interactive-hover'}`} title={thread.title}>{thread.title}</button>
              {threads.length > 1 && (
                <button type="button" onClick={() => deleteThread(thread.id)} className="hidden h-6 w-6 items-center justify-center rounded text-on-surface-variant hover:bg-interactive-hover hover:text-error group-hover:flex" title="Xóa tác vụ"><span className="material-symbols-outlined text-[13px]">close</span></button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-outline-variant/60 px-2 py-2">
        <details className="group mb-1">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-on-surface-variant hover:bg-interactive-hover">
            <span className="material-symbols-outlined text-[15px]">more_horiz</span><span>Công cụ khác</span>
          </summary>
          <div className="pb-1 pl-2">{TOOL_ITEMS.map((item) => <SidebarNavItem key={item.surface} item={item} active={activeView === item.surface} onOpen={openSurface} />)}</div>
        </details>
        <SidebarButton label="Cài đặt" icon="settings" active={activeView === 'settings'} onClick={() => openSurface('settings')} />
        <div className="flex items-center justify-between px-2 pt-2 text-[9px] text-on-surface-variant"><span>AgentStudio</span><span>{appVersion ? `v${appVersion}` : ''}</span></div>
      </div>
    </nav>
  );
}

function SidebarNavItem({ item, active, onOpen }: { item: SidebarItem; active: boolean; onOpen: (surface: WorkspaceSurface) => string }) {
  return <SidebarButton label={item.label} icon={item.icon} active={active} onClick={() => onOpen(item.surface)} />;
}

function SidebarButton({ label, icon, active = false, onClick }: { label: string; icon: string; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[11px] ${active ? 'bg-interactive-selected font-medium text-on-surface' : 'text-on-surface-variant hover:bg-interactive-hover'}`}>
      <span className="material-symbols-outlined text-[15px]">{icon}</span><span className="truncate">{label}</span>
    </button>
  );
}

function basename(filePath: string | null): string {
  return filePath?.split(/[\\/]/).filter(Boolean).pop() ?? '';
}
