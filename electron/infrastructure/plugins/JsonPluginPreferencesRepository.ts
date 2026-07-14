import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { PluginPreferences } from '../../domain/entities/plugin.js';
import type { IPluginPreferencesRepository } from '../../domain/ports/IPluginPreferencesRepository.js';
import { writePrivateFileAtomic } from '../storage/privateFile.js';

const EMPTY: PluginPreferences = { enabledPluginIds: [], trustedPluginIds: [] };

export class JsonPluginPreferencesRepository implements IPluginPreferencesRepository {
  async load() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath(), 'utf8')) as Partial<PluginPreferences>;
      return { enabledPluginIds: readStrings(parsed.enabledPluginIds), trustedPluginIds: readStrings(parsed.trustedPluginIds) };
    } catch {
      return structuredClone(EMPTY);
    }
  }

  async save(preferences: PluginPreferences) {
    await writePrivateFileAtomic(this.filePath(), JSON.stringify(preferences, null, 2));
  }

  private filePath() {
    return path.join(app.getPath('userData'), 'plugin-preferences.json');
  }
}

function readStrings(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))].slice(0, 200) : [];
}
