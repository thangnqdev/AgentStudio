import type { AppSlice, UiSlice } from './appStoreTypes';

export const createUiSlice: AppSlice<UiSlice> = (set) => ({
  projectPath: 'agent-desktop',
  currentBranch: null,
  activeView: 'tasks',
  isSidebarOpen: true,
  isTerminalOpen: false,
  setProjectPath: (path) => set({ projectPath: path }),
  setCurrentBranch: (branch) => set({ currentBranch: branch }),
  setActiveView: (view) => set({ activeView: view }),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setTerminalOpen: (open) => set({ isTerminalOpen: open }),
});
