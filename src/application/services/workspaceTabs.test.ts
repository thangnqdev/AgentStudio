import { describe, expect, it } from 'vitest';
import type { WorkspaceTab } from '../../domain/entities/workspaceTab';
import { closeWorkspaceTab, openWorkspaceTab } from './workspaceTabs';

const taskTab = (id: string, threadId: string): WorkspaceTab => ({
  id,
  threadId,
  surface: 'tasks',
  title: `Task ${threadId}`,
});

describe('workspaceTabs', () => {
  it('reuses a task tab when the same thread is opened from the sidebar', () => {
    const existing = taskTab('tab-1', 'thread-1');
    const result = openWorkspaceTab([existing], {
      surface: 'tasks', title: 'Renamed task', threadId: 'thread-1', reuseKey: 'tasks:thread-1',
    }, () => 'tab-2');

    expect(result).toEqual({ tabs: [existing], activeTabId: 'tab-1' });
  });

  it('allows the plus launcher to create another surface tab', () => {
    const result = openWorkspaceTab([], { surface: 'terminal', title: 'Giao diện dòng lệnh' }, () => 'tab-terminal');

    expect(result.tabs).toEqual([{ id: 'tab-terminal', surface: 'terminal', title: 'Giao diện dòng lệnh' }]);
    expect(result.activeTabId).toBe('tab-terminal');
  });

  it('selects the adjacent tab when the active tab closes', () => {
    const tabs = [taskTab('tab-1', 'thread-1'), taskTab('tab-2', 'thread-2'), taskTab('tab-3', 'thread-3')];

    expect(closeWorkspaceTab(tabs, 'tab-2', 'tab-2').activeTabId).toBe('tab-3');
    expect(closeWorkspaceTab(tabs, 'tab-3', 'tab-3').activeTabId).toBe('tab-2');
  });

  it('returns to the zero-tab launcher when the final tab closes', () => {
    expect(closeWorkspaceTab([taskTab('tab-1', 'thread-1')], 'tab-1', 'tab-1')).toEqual({
      tabs: [], activeTabId: null,
    });
  });
});
