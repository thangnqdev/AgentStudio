import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useWorkspaceTabs } from '../../application/hooks/useWorkspaceTabs';
import { useAppStore } from '../../store/useAppStore';
import type { WorkspaceLaunchAction } from './workspaceLaunchOptions';
import { WORKSPACE_LAUNCH_OPTIONS } from './workspaceLaunchOptions';

const SURFACE_ICONS: Record<string, string> = {
  tasks: 'chat_bubble', evaluations: 'fact_check', terminal: 'terminal', browser: 'language', files: 'folder_open',
  knowledge: 'menu_book', observability: 'monitoring', workflows: 'account_tree', capabilities: 'extension',
  optimizer: 'tune', 'skill-learning': 'school', agents: 'smart_toy', settings: 'settings',
};

export function WorkspaceTabBar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const threads = useAppStore((state) => state.threads);
  const { tabs, activeTabId, activate, close, createTask, openSurface } = useWorkspaceTabs();

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', closeMenu);
    return () => window.removeEventListener('mousedown', closeMenu);
  }, [menuOpen]);

  const open = (action: WorkspaceLaunchAction) => {
    setMenuOpen(false);
    if (action === 'new-task') createTask();
    else if (action === 'side-task') createTask(true);
    else openSurface(action, true);
  };

  return (
    <div className="flex min-w-0 flex-1 items-stretch overflow-visible" style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}>
      <div className="flex min-w-0 items-stretch overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const threadTitle = tab.threadId ? threads.find((thread) => thread.id === tab.threadId)?.title : undefined;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => activate(tab.id)}
              className={`group relative flex h-10 max-w-[230px] min-w-[132px] items-center gap-2 border-r border-outline-variant/60 px-3 text-[12px] transition ${active ? 'bg-surface text-on-surface' : 'bg-toolbar text-on-surface-variant hover:bg-surface-container-low'}`}
              title={threadTitle ?? tab.title}
            >
              <span className="material-symbols-outlined shrink-0 text-[15px]">{SURFACE_ICONS[tab.surface] ?? 'draft'}</span>
              <span className="min-w-0 flex-1 truncate text-left">{threadTitle ?? tab.title}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => { event.stopPropagation(); close(tab.id); }}
                onKeyDown={(event) => { if (event.key === 'Enter') close(tab.id); }}
                className="material-symbols-outlined flex h-5 w-5 shrink-0 items-center justify-center rounded text-[14px] opacity-0 hover:bg-interactive-hover group-hover:opacity-100"
                aria-label={`Đóng ${threadTitle ?? tab.title}`}
              >close</span>
              {active && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" />}
            </button>
          );
        })}
      </div>
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-10 w-10 items-center justify-center text-on-surface-variant hover:bg-interactive-hover hover:text-on-surface"
          title="Thêm tab"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
        </button>
        {menuOpen && (
          <div className="absolute left-0 top-[42px] z-50 w-[245px] rounded-xl border border-outline-variant/60 bg-surface p-1.5 shadow-[0_12px_38px_var(--theme-shadow)]">
            {WORKSPACE_LAUNCH_OPTIONS.slice(1).map((option) => (
              <button key={option.action} type="button" onClick={() => open(option.action)} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-surface-container">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant">{option.icon}</span>
                <span className="flex-1 text-[12px] text-on-surface">{option.label}</span>
                {option.shortcut && <kbd className="text-[10px] text-on-surface-variant">{option.shortcut}</kbd>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
