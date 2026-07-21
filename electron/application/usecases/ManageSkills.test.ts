import { describe, expect, it } from 'vitest';
import type { SkillDescriptor, SkillPreferences } from '../../domain/entities/skill.js';
import { ManageSkills } from './ManageSkills.js';

const frontend: SkillDescriptor = {
  id: 'frontend-id', name: 'frontend', description: 'Build React interfaces and components', origin: 'workspace', rootPath: '/workspace/.agents/skills/frontend',
};

describe('ManageSkills', () => {
  it('loads matching instructions only after explicit trust and enablement', async () => {
    let preferences: SkillPreferences = { enabledSkillIds: [], trustedSkillIds: [] };
    const manager = new ManageSkills(
      {
        discover: async () => [frontend],
        readInstructions: async () => 'Use accessible React components.',
        installFromDirectory: async () => undefined,
        removeManaged: async () => undefined,
      },
      { load: async () => preferences, save: async (next) => { preferences = next; } },
    );

    expect(await manager.buildPromptContext('/workspace', 'Build a React component')).toBe('');
    await manager.setTrusted('/workspace', frontend.id, true);
    await manager.setEnabled('/workspace', frontend.id, true);
    const context = await manager.buildPromptContext('/workspace', 'Build a React component');
    expect(context).toContain('<skill name="frontend"');
    expect(context).toContain('Use accessible React components.');
  });

  it('disabling trust also disables the skill', async () => {
    let preferences: SkillPreferences = { enabledSkillIds: [frontend.id], trustedSkillIds: [frontend.id] };
    const manager = new ManageSkills(
      {
        discover: async () => [frontend], readInstructions: async () => '',
        installFromDirectory: async () => undefined, removeManaged: async () => undefined,
      },
      { load: async () => preferences, save: async (next) => { preferences = next; } },
    );
    const skills = await manager.setTrusted('/workspace', frontend.id, false);
    expect(skills[0]).toMatchObject({ trusted: false, enabled: false });
  });
});
