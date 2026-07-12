function bridge() {
  if (!window.agentStudio) throw new Error('Electron bridge is not available.');
  return window.agentStudio;
}

export const CapabilityBridge = {
  list: () => bridge().listCapabilities(),
  recommend: (payload: Parameters<NonNullable<Window['agentStudio']>['recommendCapabilities']>[0]) => bridge().recommendCapabilities(payload),
  listSkills: () => bridge().listSkills(),
  setSkillEnabled: (payload: Parameters<NonNullable<Window['agentStudio']>['setSkillEnabled']>[0]) => bridge().setSkillEnabled(payload),
  setSkillTrusted: (payload: Parameters<NonNullable<Window['agentStudio']>['setSkillTrusted']>[0]) => bridge().setSkillTrusted(payload),
  listMcpServers: () => bridge().listMcpServers(),
  saveMcpServer: (payload: Parameters<NonNullable<Window['agentStudio']>['saveMcpServer']>[0]) => bridge().saveMcpServer(payload),
  removeMcpServer: (serverId: string) => bridge().removeMcpServer(serverId),
  startMcpServer: (serverId: string) => bridge().startMcpServer(serverId),
  stopMcpServer: (serverId: string) => bridge().stopMcpServer(serverId),
};
