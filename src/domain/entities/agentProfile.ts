export type AgentProfileStatus = {
  id: string;
  name: string;
  description: string;
  origin: 'user' | 'workspace';
  filePath: string;
  contentHash: string;
  allowedTools?: string[];
  enabled: boolean;
  trusted: boolean;
};
