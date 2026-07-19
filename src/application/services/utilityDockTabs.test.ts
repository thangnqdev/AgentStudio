import { describe, expect, it } from 'vitest';
import type { UtilityDockTab } from '../../domain/entities/utilityDock';
import {
  clampUtilityDockWidth,
  closeUtilityDockTab,
  createInitialUtilityDockTabs,
  nextTerminalTitle,
  openUtilityDockTab,
} from './utilityDockTabs';

describe('utilityDockTabs', () => {
  it('starts with a durable activity tab', () => {
    expect(createInitialUtilityDockTabs()).toEqual([
      { id: 'utility:activity', surface: 'activity', title: 'Hoạt động', closable: false },
    ]);
  });

  it('reuses singleton tools and agent detail tabs', () => {
    const initial = createInitialUtilityDockTabs();
    const first = openUtilityDockTab(initial, {
      surface: 'agent', title: 'Kiểm tra giao diện', agentId: 'agent-1', reuseKey: 'agent:agent-1',
    }, () => 'agent-tab');
    const second = openUtilityDockTab(first.tabs, {
      surface: 'agent', title: 'Tên mới', agentId: 'agent-1', reuseKey: 'agent:agent-1',
    }, () => 'unused');

    expect(second).toEqual({ tabs: first.tabs, activeTabId: 'agent-tab' });
  });

  it('allows multiple terminal sessions and closes only the selected one', () => {
    const initial = createInitialUtilityDockTabs();
    const first = openUtilityDockTab(initial, { surface: 'terminal', title: 'Dòng lệnh 1' }, () => 'terminal-1');
    const second = openUtilityDockTab(first.tabs, { surface: 'terminal', title: 'Dòng lệnh 2' }, () => 'terminal-2');
    const closed = closeUtilityDockTab(second.tabs, second.activeTabId, 'terminal-2');

    expect(second.tabs.filter((tab) => tab.surface === 'terminal')).toHaveLength(2);
    expect(closed.activeTabId).toBe('terminal-1');
  });

  it('does not close the permanent activity tab and clamps resize bounds', () => {
    const tabs: UtilityDockTab[] = createInitialUtilityDockTabs();
    expect(closeUtilityDockTab(tabs, tabs[0].id, tabs[0].id).tabs).toBe(tabs);
    expect(clampUtilityDockWidth(200)).toBe(320);
    expect(clampUtilityDockWidth(900)).toBe(560);
  });

  it('keeps terminal titles unique after another session closes', () => {
    const tabs: UtilityDockTab[] = [
      ...createInitialUtilityDockTabs(),
      { id: 'terminal-2', surface: 'terminal', title: 'Dòng lệnh 2', closable: true },
    ];
    expect(nextTerminalTitle(tabs)).toBe('Dòng lệnh 3');
  });
});
