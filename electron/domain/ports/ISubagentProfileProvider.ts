import type { LoadedAgentProfile } from '../entities/agentProfile.js';

export interface ISubagentProfileProvider {
  load(workspaceRoot: string, profileId: string): Promise<LoadedAgentProfile>;
}
