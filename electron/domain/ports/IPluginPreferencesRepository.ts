import type { PluginPreferences } from '../entities/plugin.js';

export interface IPluginPreferencesRepository {
  load(): Promise<PluginPreferences>;
  save(preferences: PluginPreferences): Promise<void>;
}
