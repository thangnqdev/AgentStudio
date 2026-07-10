import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';
import type { AgentAction } from '../../domain/entities/message';

export function useToolApproval() {
  return (action: AgentAction, approved: boolean) => {
    if (!AgentBridge.isAvailable) return;
    AgentBridge.respondToToolApproval({ requestId: action.requestId, actionId: action.id, approved });
  };
}
