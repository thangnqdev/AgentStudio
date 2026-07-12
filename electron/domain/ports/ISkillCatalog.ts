import type { SkillDescriptor } from '../entities/skill.js';

export interface ISkillCatalog {
  discover(workspaceRoot: string): Promise<SkillDescriptor[]>;
  readInstructions(skill: SkillDescriptor): Promise<string>;
}
