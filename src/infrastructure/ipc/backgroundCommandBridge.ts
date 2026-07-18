import type { BackgroundCommandNotice } from '../../domain/entities/backgroundCommand';

export const BackgroundCommandBridge = {
  subscribe(listener: (notice: BackgroundCommandNotice) => void) {
    if (!window.agentStudio) return () => {};
    return window.agentStudio.onBackgroundCommandNotice(listener);
  },
};
