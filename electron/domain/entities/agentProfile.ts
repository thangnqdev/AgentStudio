export type AgentProfileOrigin = 'user' | 'workspace';

export type AgentProfileDescriptor = {
  id: string;
  name: string;
  description: string;
  origin: AgentProfileOrigin;
  filePath: string;
  contentHash: string;
  allowedTools?: string[];
};

export type AgentProfilePreferences = {
  enabledProfileIds: string[];
  trustedProfileIds: string[];
};

export type AgentProfileStatus = AgentProfileDescriptor & {
  enabled: boolean;
  trusted: boolean;
};

export type LoadedAgentProfile = {
  id: string;
  name: string;
  instructions: string;
  allowedTools?: string[];
};
