function bridge() {
  if (!window.agentStudio) throw new Error('Electron bridge is not available.');
  return window.agentStudio;
}

export const AgentTeamBridge = {
  get isAvailable() { return typeof window !== 'undefined' && !!window.agentStudio; },
  get(scopeId: string) { return bridge().getAgentTeam(scopeId); },
  onEvent(listener: Parameters<NonNullable<Window['agentStudio']>['onAgentTeamEvent']>[0]) {
    return bridge().onAgentTeamEvent(listener);
  },
};
