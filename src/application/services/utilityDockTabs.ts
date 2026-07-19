import type {
  OpenUtilityDockTabInput,
  UtilityDockSurface,
  UtilityDockTab,
} from '../../domain/entities/utilityDock';

export const UTILITY_ACTIVITY_TAB_ID = 'utility:activity';

export function createInitialUtilityDockTabs(): UtilityDockTab[] {
  return [{ id: UTILITY_ACTIVITY_TAB_ID, surface: 'activity', title: 'Hoạt động', closable: false }];
}

export function openUtilityDockTab(
  tabs: UtilityDockTab[],
  input: OpenUtilityDockTabInput,
  createId: () => string,
) {
  const reusable = input.reuseKey
    ? tabs.find((tab) => utilityDockTabKey(tab) === input.reuseKey)
    : undefined;
  if (reusable) return { tabs, activeTabId: reusable.id };

  const { reuseKey: _reuseKey, closable = true, ...tab } = input;
  const created = { ...tab, closable, id: createId() };
  return { tabs: [...tabs, created], activeTabId: created.id };
}

export function closeUtilityDockTab(tabs: UtilityDockTab[], activeTabId: string, tabId: string) {
  const closingIndex = tabs.findIndex((tab) => tab.id === tabId);
  if (closingIndex < 0 || !tabs[closingIndex].closable) return { tabs, activeTabId };

  const remaining = tabs.filter((tab) => tab.id !== tabId);
  if (activeTabId !== tabId) return { tabs: remaining, activeTabId };
  const fallback = remaining[Math.min(closingIndex, remaining.length - 1)] ?? remaining[0];
  return { tabs: remaining, activeTabId: fallback.id };
}

export function utilityDockTabKey(tab: Pick<UtilityDockTab, 'surface' | 'agentId'>) {
  return tab.surface === 'agent' && tab.agentId ? `agent:${tab.agentId}` : tab.surface;
}

export function utilityDockSurfaceTitle(surface: Exclude<UtilityDockSurface, 'agent'>) {
  const titles: Record<Exclude<UtilityDockSurface, 'agent'>, string> = {
    activity: 'Hoạt động',
    terminal: 'Dòng lệnh',
    files: 'Tệp',
    browser: 'Trình duyệt',
    evaluations: 'Đánh giá',
    'task-details': 'Chi tiết tác vụ',
  };
  return titles[surface];
}

export function clampUtilityDockWidth(width: number) {
  return Math.min(560, Math.max(320, Math.round(width)));
}

export function nextTerminalTitle(tabs: UtilityDockTab[]) {
  const largest = tabs.reduce((maximum, tab) => {
    if (tab.surface !== 'terminal') return maximum;
    const number = Number.parseInt(tab.title.match(/\d+$/)?.[0] ?? '0', 10);
    return Math.max(maximum, number);
  }, 0);
  return `Dòng lệnh ${largest + 1}`;
}
