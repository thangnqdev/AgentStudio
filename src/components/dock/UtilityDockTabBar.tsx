import type { UtilityDockTab } from '../../domain/entities/utilityDock';

const ICONS: Record<UtilityDockTab['surface'], string> = {
  activity: 'hub', agent: 'smart_toy', terminal: 'terminal', files: 'folder_open',
  browser: 'language', evaluations: 'fact_check', 'task-details': 'info',
};

export function UtilityDockTabBar(props: {
  tabs: UtilityDockTab[];
  activeTabId: string;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
}) {
  return (
    <div className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-black/[0.07] bg-[#f7f7f7] scrollbar-none" role="tablist" aria-label="Công cụ đang mở">
      {props.tabs.map((tab) => {
        const active = tab.id === props.activeTabId;
        return (
          <button key={tab.id} type="button" role="tab" aria-selected={active} onClick={() => props.onActivate(tab.id)} title={tab.title}
            className={`group relative flex min-w-[96px] max-w-[150px] items-center gap-1.5 border-r border-black/[0.06] px-2.5 text-[10px] ${active ? 'bg-white text-[#222]' : 'text-[#777] hover:bg-white/70'}`}>
            <span className="material-symbols-outlined shrink-0 text-[14px]">{ICONS[tab.surface]}</span>
            <span className="min-w-0 flex-1 truncate text-left">{tab.title}</span>
            {tab.closable && <span role="button" tabIndex={0} aria-label={`Đóng ${tab.title}`} onClick={(event) => { event.stopPropagation(); props.onClose(tab.id); }} onKeyDown={(event) => { if (event.key === 'Enter') props.onClose(tab.id); }} className="material-symbols-outlined flex h-4 w-4 shrink-0 items-center justify-center rounded text-[12px] opacity-0 hover:bg-black/[0.06] group-hover:opacity-100">close</span>}
            {active && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#333]" />}
          </button>
        );
      })}
    </div>
  );
}
