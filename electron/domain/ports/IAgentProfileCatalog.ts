import type { AgentProfileDescriptor } from '../entities/agentProfile.js';

export interface IAgentProfileCatalog {
  discover(workspaceRoot: string): Promise<AgentProfileDescriptor[]>;
  readInstructions(profile: AgentProfileDescriptor): Promise<string>;
}
