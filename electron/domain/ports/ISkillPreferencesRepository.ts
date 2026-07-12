import type { SkillPreferences } from '../entities/skill.js';

export interface ISkillPreferencesRepository {
  load(): Promise<SkillPreferences>;
  save(preferences: SkillPreferences): Promise<void>;
}
