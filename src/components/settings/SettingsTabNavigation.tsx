import { useHorizontalTabList } from '../../application/hooks/useHorizontalTabList';
import { TabScrollButton } from '../TabScrollButton';
import { SETTINGS_TABS, type SettingsTabId } from './settingsTabs';

export function SettingsTabNavigation(props: {
  activeTab: SettingsTabId;
  onChange: (tab: SettingsTabId) => void;
}) {
  const tabList = useHorizontalTabList(props.activeTab);
  return (
    <>
      <div className="settings-tabs-wide -mb-px min-w-0 items-end">
        {tabList.hasOverflow && <TabScrollButton compact direction="back" disabled={!tabList.canScrollBack} onClick={() => tabList.scrollByPage(-1)} />}
        <div ref={tabList.viewportRef} onScroll={tabList.updateScrollState} onWheel={tabList.handleWheel} className="min-w-0 flex-1 overflow-x-auto scrollbar-none" role="tablist" aria-label="Nhóm cài đặt">
          <div className="flex w-max min-w-full items-end">
            {SETTINGS_TABS.map((tab) => (
              <button key={tab.id} data-tab-id={tab.id} type="button" role="tab" aria-selected={props.activeTab === tab.id} onClick={() => props.onChange(tab.id)} className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[12px] font-medium transition-colors ${props.activeTab === tab.id ? 'border-secondary text-secondary' : 'border-transparent text-on-surface-variant hover:border-outline-variant hover:text-on-surface'}`}>
                <span className="material-symbols-outlined text-[15px]">{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
        </div>
        {tabList.hasOverflow && <TabScrollButton compact direction="forward" disabled={!tabList.canScrollForward} onClick={() => tabList.scrollByPage(1)} />}
      </div>
      <label className="settings-tabs-compact pb-3">
        <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">Nhóm cài đặt</span>
        <select value={props.activeTab} onChange={(event) => props.onChange(event.target.value as SettingsTabId)} className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-[12px] text-on-surface outline-none focus:border-secondary">
          {SETTINGS_TABS.map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
        </select>
      </label>
    </>
  );
}
