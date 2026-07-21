import type { AppSlice, UiSlice } from './appStoreTypes';
import {
  clampUtilityDockWidth,
  closeUtilityDockTab,
  createInitialUtilityDockTabs,
  openUtilityDockTab,
  UTILITY_ACTIVITY_TAB_ID,
} from '../application/services/utilityDockTabs';
import { clampSidebarWidth, DEFAULT_SIDEBAR_WIDTH } from '../application/services/sidebarLayout';

export const createUiSlice: AppSlice<UiSlice> = (set, get) => ({
  projectPath: null,
  currentBranch: null,
  activeView: null,
  isSidebarOpen: true,
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
  isUtilityDockOpen: false,
  utilityDockWidth: 380,
  utilityDockTabs: createInitialUtilityDockTabs(),
  activeUtilityDockTabId: UTILITY_ACTIVITY_TAB_ID,
  pendingWorkspaceThreadId: null,
  setProjectPath: (path) => set({ projectPath: path }),
  setCurrentBranch: (branch) => set({ currentBranch: branch }),
  setActiveView: (view) => set({ activeView: view }),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setSidebarWidth: (width) => set({ sidebarWidth: clampSidebarWidth(width) }),
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
  requestWorkspaceThread: (threadId) => set({ pendingWorkspaceThreadId: threadId }),
});
