import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { SkillPreferences } from '../../domain/entities/skill.js';
import type { ISkillPreferencesRepository } from '../../domain/ports/ISkillPreferencesRepository.js';
import { writePrivateFileAtomic } from '../storage/privateFile.js';

const EMPTY_PREFERENCES: SkillPreferences = { enabledSkillIds: [], trustedSkillIds: [] };

export class JsonSkillPreferencesRepository implements ISkillPreferencesRepository {
  async load(): Promise<SkillPreferences> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.getPath(), 'utf8')) as Partial<SkillPreferences>;
      return {
        enabledSkillIds: readStrings(parsed.enabledSkillIds),
        trustedSkillIds: readStrings(parsed.trustedSkillIds),
      };
    } catch {
      return { ...EMPTY_PREFERENCES };
    }
  }

  async save(preferences: SkillPreferences) {
    await writePrivateFileAtomic(this.getPath(), JSON.stringify(preferences, null, 2));
  }

  private getPath() {
    return path.join(app.getPath('userData'), 'skill-preferences.json');
  }
}

function readStrings(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))] : [];
}
