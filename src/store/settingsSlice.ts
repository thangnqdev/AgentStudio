import type { AppSettings } from '../domain/entities/settings';
import type { AppSlice, SettingsSlice } from './appStoreTypes';

const DEFAULT_SETTINGS: AppSettings = {
  providers: [],
  activeProviderId: null,
  activeModelId: null,
  fallbackModelId: null,
  permissionMode: 'workspace-write',
  workspacePath: 'chưa có dự án',
};

export const createSettingsSlice: AppSlice<SettingsSlice> = (set) => ({
  settings: DEFAULT_SETTINGS,
  setSettings: (settings) => set((state) => ({
    settings: { ...state.settings, ...settings },
  })),
});
