import type { AgentProfilePreferences } from '../entities/agentProfile.js';

export interface IAgentProfilePreferencesRepository {
  load(): Promise<AgentProfilePreferences>;
  save(preferences: AgentProfilePreferences): Promise<void>;
}
