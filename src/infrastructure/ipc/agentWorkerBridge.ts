function bridge() {
  if (!window.agentStudio) throw new Error('Electron bridge is not available.');
  return window.agentStudio;
}

export const AgentWorkerBridge = {
  get isAvailable() { return typeof window !== 'undefined' && !!window.agentStudio; },
  list(scopeId: string) { return bridge().listAgentWorkers(scopeId); },
  stop(scopeId: string, agentId: string) { return bridge().stopAgentWorker({ scopeId, agentId }); },
  approve(agentId: string, actionId: string, approved: boolean) {
    bridge().respondToAgentWorkerApproval({ agentId, actionId, approved });
  },
  onEvent(listener: Parameters<NonNullable<Window['agentStudio']>['onAgentWorkerEvent']>[0]) {
    return bridge().onAgentWorkerEvent(listener);
  },
};
