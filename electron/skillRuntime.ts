import { ManageSkills } from './application/usecases/ManageSkills.js';
import { FileSystemSkillCatalog } from './infrastructure/skills/FileSystemSkillCatalog.js';
import { JsonSkillPreferencesRepository } from './infrastructure/skills/JsonSkillPreferencesRepository.js';

export const skillManager = new ManageSkills(
  new FileSystemSkillCatalog(),
  new JsonSkillPreferencesRepository(),
);
