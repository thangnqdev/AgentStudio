import { ManageAgentProfiles } from './application/usecases/ManageAgentProfiles.js';
import { FileSystemAgentProfileCatalog } from './infrastructure/agents/FileSystemAgentProfileCatalog.js';
import { JsonAgentProfilePreferencesRepository } from './infrastructure/agents/JsonAgentProfilePreferencesRepository.js';

export const agentProfileManager = new ManageAgentProfiles(
  new FileSystemAgentProfileCatalog(),
  new JsonAgentProfilePreferencesRepository(),
);
