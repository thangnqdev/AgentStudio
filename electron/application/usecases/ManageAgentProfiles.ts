import type { AgentProfileDescriptor, AgentProfileStatus } from '../../domain/entities/agentProfile.js';
import type { IAgentProfileCatalog } from '../../domain/ports/IAgentProfileCatalog.js';
import type { IAgentProfilePreferencesRepository } from '../../domain/ports/IAgentProfilePreferencesRepository.js';
import type { ISubagentProfileProvider } from '../../domain/ports/ISubagentProfileProvider.js';

const MAX_PROFILE_INSTRUCTION_CHARACTERS = 20_000;
const MAX_PROMPT_PROFILES = 20;

export class ManageAgentProfiles implements ISubagentProfileProvider {
  private readonly catalog: IAgentProfileCatalog;
  private readonly preferences: IAgentProfilePreferencesRepository;

  constructor(
    catalog: IAgentProfileCatalog,
    preferences: IAgentProfilePreferencesRepository,
  ) {
    this.catalog = catalog;
    this.preferences = preferences;
  }

  async list(workspaceRoot: string): Promise<AgentProfileStatus[]> {
    const [profiles, preferences] = await Promise.all([this.catalog.discover(workspaceRoot), this.preferences.load()]);
    const enabled = new Set(preferences.enabledProfileIds);
    const trusted = new Set(preferences.trustedProfileIds);
    return profiles.map((profile) => ({ ...profile, enabled: enabled.has(profile.id), trusted: trusted.has(profile.id) }));
  }

  async setEnabled(workspaceRoot: string, profileId: string, enabled: boolean) {
    await this.ensureExists(workspaceRoot, profileId);
    const preferences = await this.preferences.load();
    if (enabled && !preferences.trustedProfileIds.includes(profileId)) throw new Error('Trust the agent profile before enabling it.');
    preferences.enabledProfileIds = updateSet(preferences.enabledProfileIds, profileId, enabled);
    await this.preferences.save(preferences);
    return this.list(workspaceRoot);
  }

  async setTrusted(workspaceRoot: string, profileId: string, trusted: boolean) {
    await this.ensureExists(workspaceRoot, profileId);
    const preferences = await this.preferences.load();
    preferences.trustedProfileIds = updateSet(preferences.trustedProfileIds, profileId, trusted);
    if (!trusted) preferences.enabledProfileIds = updateSet(preferences.enabledProfileIds, profileId, false);
    await this.preferences.save(preferences);
    return this.list(workspaceRoot);
  }

  async load(workspaceRoot: string, profileId: string) {
    const profile = (await this.list(workspaceRoot)).find((item) => item.id === profileId);
    if (!profile) throw new Error('Agent profile does not exist.');
    if (!profile.trusted || !profile.enabled) throw new Error('Agent profile must be trusted and enabled before use.');
    const instructions = (await this.catalog.readInstructions(profile)).slice(0, MAX_PROFILE_INSTRUCTION_CHARACTERS);
    return { id: profile.id, name: profile.name, instructions, allowedTools: profile.allowedTools };
  }

  async buildPromptContext(workspaceRoot: string) {
    const active = (await this.list(workspaceRoot)).filter((profile) => profile.enabled && profile.trusted).slice(0, MAX_PROMPT_PROFILES);
    if (!active.length) return '';
    return [
      'Available trusted subagent profiles. Use delegate_task with agentId only when a profile matches the delegated work:',
      ...active.map((profile) => `- ${profile.id}: ${profile.name} — ${profile.description}`),
      'Profiles only specialize a read-only subagent and never expand its tools or permission policy.',
    ].join('\n');
  }

  private async ensureExists(workspaceRoot: string, profileId: string): Promise<AgentProfileDescriptor> {
    const profile = (await this.catalog.discover(workspaceRoot)).find((item) => item.id === profileId);
    if (!profile) throw new Error('Agent profile does not exist.');
    return profile;
  }
}

function updateSet(values: string[], value: string, included: boolean) {
  const next = new Set(values);
  if (included) next.add(value); else next.delete(value);
  return [...next];
}
