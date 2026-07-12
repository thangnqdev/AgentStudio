export type SkillStatus = {
  id: string;
  name: string;
  description: string;
  origin: 'user' | 'workspace';
  rootPath: string;
  compatibility?: string;
  allowedTools?: string[];
  enabled: boolean;
  trusted: boolean;
};
