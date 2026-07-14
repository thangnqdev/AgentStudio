import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { AgentProfilePreferences } from '../../domain/entities/agentProfile.js';
import type { IAgentProfilePreferencesRepository } from '../../domain/ports/IAgentProfilePreferencesRepository.js';
import { writePrivateFileAtomic } from '../storage/privateFile.js';

const EMPTY: AgentProfilePreferences = { enabledProfileIds: [], trustedProfileIds: [] };

export class JsonAgentProfilePreferencesRepository implements IAgentProfilePreferencesRepository {
  async load() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath(), 'utf8')) as Partial<AgentProfilePreferences>;
      return { enabledProfileIds: readStrings(parsed.enabledProfileIds), trustedProfileIds: readStrings(parsed.trustedProfileIds) };
    } catch {
      return structuredClone(EMPTY);
    }
  }

  async save(preferences: AgentProfilePreferences) {
    await writePrivateFileAtomic(this.filePath(), JSON.stringify(preferences, null, 2));
  }

  private filePath() {
    return path.join(app.getPath('userData'), 'agent-profile-preferences.json');
  }
}

function readStrings(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))].slice(0, 200) : [];
}
