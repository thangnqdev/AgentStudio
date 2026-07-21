import type { UtilityDockTab } from '../../domain/entities/utilityDock';
import { useHorizontalTabList } from '../../application/hooks/useHorizontalTabList';
import { TabScrollButton } from '../TabScrollButton';
import { UTILITY_DOCK_ICONS } from './utilityDockOptions';

export function UtilityDockTabBar(props: {
  tabs: UtilityDockTab[];
  activeTabId: string;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
}) {
  const tabList = useHorizontalTabList(props.activeTabId);
  return (
    <div className="flex h-8 shrink-0 items-stretch border-b border-outline-variant/60 bg-surface-container-low">
      {tabList.hasOverflow && <TabScrollButton compact direction="back" disabled={!tabList.canScrollBack} onClick={() => tabList.scrollByPage(-1)} />}
      <div ref={tabList.viewportRef} onScroll={tabList.updateScrollState} onWheel={tabList.handleWheel} className="min-w-0 flex-1 overflow-x-auto scroll-smooth scrollbar-none" role="tablist" aria-label="Công cụ đang mở">
        <div className="flex h-full min-w-full w-max items-stretch">
          {props.tabs.map((tab) => {
            const active = tab.id === props.activeTabId;
            return (
              <button key={tab.id} data-tab-id={tab.id} type="button" role="tab" aria-selected={active} onClick={() => props.onActivate(tab.id)} title={tab.title}
                className={`group relative flex min-w-[84px] max-w-[132px] items-center gap-1.5 border-r border-outline-variant/60 px-2 text-[10px] ${active ? 'bg-surface text-on-surface' : 'text-on-surface-variant hover:bg-surface/70'}`}>
                <span className="material-symbols-outlined shrink-0 text-[14px]">{UTILITY_DOCK_ICONS[tab.surface]}</span>
                <span className="min-w-0 flex-1 truncate text-left">{tab.title}</span>
                {tab.closable && <span role="button" tabIndex={0} aria-label={`Đóng ${tab.title}`} onClick={(event) => { event.stopPropagation(); props.onClose(tab.id); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); props.onClose(tab.id); } }} className={`material-symbols-outlined flex h-4 w-4 shrink-0 items-center justify-center rounded text-[12px] hover:bg-interactive-hover ${active ? 'opacity-70' : 'opacity-0 group-hover:opacity-70 group-focus-within:opacity-70'}`}>close</span>}
                {active && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-primary" />}
              </button>
            );
          })}
        </div>
      </div>
      {tabList.hasOverflow && <TabScrollButton compact direction="forward" disabled={!tabList.canScrollForward} onClick={() => tabList.scrollByPage(1)} />}
    </div>
  );
}
