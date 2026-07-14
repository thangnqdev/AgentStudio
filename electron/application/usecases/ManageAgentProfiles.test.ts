import { describe, expect, it } from 'vitest';
import type { AgentProfileDescriptor, AgentProfilePreferences } from '../../domain/entities/agentProfile.js';
import { ManageAgentProfiles } from './ManageAgentProfiles.js';

const profile: AgentProfileDescriptor = { id: 'profile-1', name: 'reviewer', description: 'Strict reviewer', origin: 'workspace', filePath: '/workspace/reviewer.md', contentHash: 'hash-1', allowedTools: ['read_file'] };

describe('ManageAgentProfiles', () => {
  it('requires explicit trust and enable before loading instructions', async () => {
    let preferences: AgentProfilePreferences = { enabledProfileIds: [], trustedProfileIds: [] };
    const manager = new ManageAgentProfiles(
      { discover: async () => [profile], readInstructions: async () => 'Review for correctness.' },
      { load: async () => structuredClone(preferences), save: async (next) => { preferences = structuredClone(next); } },
    );
    await expect(manager.load('/workspace', profile.id)).rejects.toThrow('trusted and enabled');
    await expect(manager.setEnabled('/workspace', profile.id, true)).rejects.toThrow('Trust');
    await manager.setTrusted('/workspace', profile.id, true);
    await manager.setEnabled('/workspace', profile.id, true);
    await expect(manager.load('/workspace', profile.id)).resolves.toMatchObject({ name: 'reviewer', instructions: 'Review for correctness.', allowedTools: ['read_file'] });
    await expect(manager.buildPromptContext('/workspace')).resolves.toContain('profile-1: reviewer');
  });

  it('disables a profile when trust is revoked', async () => {
    let preferences: AgentProfilePreferences = { enabledProfileIds: [profile.id], trustedProfileIds: [profile.id] };
    const manager = new ManageAgentProfiles(
      { discover: async () => [profile], readInstructions: async () => '' },
      { load: async () => structuredClone(preferences), save: async (next) => { preferences = structuredClone(next); } },
    );
    const statuses = await manager.setTrusted('/workspace', profile.id, false);
    expect(statuses[0]).toMatchObject({ enabled: false, trusted: false });
  });
});
