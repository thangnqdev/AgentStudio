import type { ManualCompactionPayload } from '../../domain/entities/manualCompaction';

export const ManualCompactionBridge = {
  compact(payload: ManualCompactionPayload) {
    if (!window.agentStudio) throw new Error('Electron bridge is not available.');
    return window.agentStudio.compactConversation(payload);
  },
};
