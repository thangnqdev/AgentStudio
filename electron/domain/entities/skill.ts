export type SkillOrigin = 'user' | 'workspace';

export type SkillDescriptor = {
  id: string;
  name: string;
  description: string;
  origin: SkillOrigin;
  rootPath: string;
  managed?: boolean;
  compatibility?: string;
  allowedTools?: string[];
};

export type SkillPreferences = {
  enabledSkillIds: string[];
  trustedSkillIds: string[];
};

export type SkillStatus = SkillDescriptor & {
  enabled: boolean;
  trusted: boolean;
};
