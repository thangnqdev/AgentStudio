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
  installSkill: () => bridge().installSkill(),
  removeSkill: (skillId: string) => bridge().removeSkill(skillId),
  listAgentProfiles: () => bridge().listAgentProfiles(),
  setAgentProfileEnabled: (payload: Parameters<NonNullable<Window['agentStudio']>['setAgentProfileEnabled']>[0]) => bridge().setAgentProfileEnabled(payload),
  setAgentProfileTrusted: (payload: Parameters<NonNullable<Window['agentStudio']>['setAgentProfileTrusted']>[0]) => bridge().setAgentProfileTrusted(payload),
  listMcpServers: () => bridge().listMcpServers(),
  saveMcpServer: (payload: Parameters<NonNullable<Window['agentStudio']>['saveMcpServer']>[0]) => bridge().saveMcpServer(payload),
  removeMcpServer: (serverId: string) => bridge().removeMcpServer(serverId),
  startMcpServer: (serverId: string) => bridge().startMcpServer(serverId),
  stopMcpServer: (serverId: string) => bridge().stopMcpServer(serverId),
  authenticateMcpServer: (serverId: string) => bridge().authenticateMcpServer(serverId),
};
