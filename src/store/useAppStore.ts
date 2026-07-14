import { create } from 'zustand';
import { createAgentSlice } from './agentSlice';
import type { AppState } from './appStoreTypes';
import { createChatSlice } from './chatSlice';
import { createSettingsSlice } from './settingsSlice';
import { createUiSlice } from './uiSlice';

export type { ViewId } from './appStoreTypes';

export const useAppStore = create<AppState>()((...arguments_) => ({
  ...createUiSlice(...arguments_),
  ...createSettingsSlice(...arguments_),
  ...createChatSlice(...arguments_),
  ...createAgentSlice(...arguments_),
}));
