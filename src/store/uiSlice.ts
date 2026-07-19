import type { AppSlice, UiSlice } from './appStoreTypes';
import { closeWorkspaceTab, openWorkspaceTab, workspaceSurfaceTitle } from '../application/services/workspaceTabs';
import {
  clampUtilityDockWidth,
  closeUtilityDockTab,
  createInitialUtilityDockTabs,
  openUtilityDockTab,
  UTILITY_ACTIVITY_TAB_ID,
} from '../application/services/utilityDockTabs';

export const createUiSlice: AppSlice<UiSlice> = (set, get) => ({
  projectPath: 'agent-desktop',
  currentBranch: null,
  activeView: 'tasks',
  isSidebarOpen: true,
  isUtilityDockOpen: false,
  utilityDockWidth: 400,
  utilityDockTabs: createInitialUtilityDockTabs(),
  activeUtilityDockTabId: UTILITY_ACTIVITY_TAB_ID,
  workspaceTabs: [],
  activeWorkspaceTabId: null,
  setProjectPath: (path) => set({ projectPath: path }),
  setCurrentBranch: (branch) => set({ currentBranch: branch }),
  setActiveView: (view) => {
    const state = get();
    const threadId = view === 'tasks' ? state.activeThreadId ?? undefined : undefined;
    const result = openWorkspaceTab(state.workspaceTabs, {
      surface: view,
      title: view === 'tasks' ? state.activeTask ?? 'Tác vụ mới' : workspaceSurfaceTitle(view),
      threadId,
      reuseKey: view === 'tasks' && threadId ? `tasks:${threadId}` : view,
    }, () => crypto.randomUUID());
    set({ activeView: view, workspaceTabs: result.tabs, activeWorkspaceTabId: result.activeTabId });
  },
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setUtilityDockOpen: (open) => set({ isUtilityDockOpen: open }),
  toggleUtilityDock: () => set((state) => ({ isUtilityDockOpen: !state.isUtilityDockOpen })),
  setUtilityDockWidth: (width) => set({ utilityDockWidth: clampUtilityDockWidth(width) }),
  openUtilityDockTab: (input) => {
    const result = openUtilityDockTab(get().utilityDockTabs, input, () => crypto.randomUUID());
    set({ utilityDockTabs: result.tabs, activeUtilityDockTabId: result.activeTabId, isUtilityDockOpen: true });
    return result.activeTabId;
  },
  activateUtilityDockTab: (tabId) => set((state) => (
    state.utilityDockTabs.some((tab) => tab.id === tabId)
      ? { activeUtilityDockTabId: tabId, isUtilityDockOpen: true }
      : {}
  )),
  closeUtilityDockTab: (tabId) => {
    const state = get();
    const result = closeUtilityDockTab(state.utilityDockTabs, state.activeUtilityDockTabId, tabId);
    set({ utilityDockTabs: result.tabs, activeUtilityDockTabId: result.activeTabId });
    return result.activeTabId;
  },
  openWorkspaceTab: (input) => {
    const result = openWorkspaceTab(get().workspaceTabs, input, () => crypto.randomUUID());
    set({ workspaceTabs: result.tabs, activeWorkspaceTabId: result.activeTabId, activeView: input.surface });
    return result.activeTabId;
  },
  activateWorkspaceTab: (tabId) => set((state) => {
    const tab = state.workspaceTabs.find((candidate) => candidate.id === tabId);
    return tab ? { activeWorkspaceTabId: tabId, activeView: tab.surface } : {};
  }),
  closeWorkspaceTab: (tabId) => {
    const state = get();
    const result = closeWorkspaceTab(state.workspaceTabs, state.activeWorkspaceTabId, tabId);
    const activeTab = result.tabs.find((tab) => tab.id === result.activeTabId);
    set({
      workspaceTabs: result.tabs,
      activeWorkspaceTabId: result.activeTabId,
      ...(activeTab ? { activeView: activeTab.surface } : {}),
    });
    return result.activeTabId;
  },
});
