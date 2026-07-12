import type { SkillDescriptor, SkillStatus } from '../../domain/entities/skill.js';
import type { ISkillCatalog } from '../../domain/ports/ISkillCatalog.js';
import type { ISkillPreferencesRepository } from '../../domain/ports/ISkillPreferencesRepository.js';

const MAX_ACTIVE_SKILLS = 2;
const MAX_INSTRUCTION_CHARACTERS = 20_000;

export class ManageSkills {
  private readonly catalog: ISkillCatalog;
  private readonly preferencesRepository: ISkillPreferencesRepository;

  constructor(
    catalog: ISkillCatalog,
    preferencesRepository: ISkillPreferencesRepository,
  ) {
    this.catalog = catalog;
    this.preferencesRepository = preferencesRepository;
  }

  async list(workspaceRoot: string): Promise<SkillStatus[]> {
    const [skills, preferences] = await Promise.all([this.catalog.discover(workspaceRoot), this.preferencesRepository.load()]);
    const enabled = new Set(preferences.enabledSkillIds);
    const trusted = new Set(preferences.trustedSkillIds);
    return skills.map((skill) => ({ ...skill, enabled: enabled.has(skill.id), trusted: trusted.has(skill.id) }));
  }

  async setEnabled(workspaceRoot: string, skillId: string, enabled: boolean) {
    await this.ensureExists(workspaceRoot, skillId);
    const preferences = await this.preferencesRepository.load();
    preferences.enabledSkillIds = updateSet(preferences.enabledSkillIds, skillId, enabled);
    await this.preferencesRepository.save(preferences);
    return this.list(workspaceRoot);
  }

  async setTrusted(workspaceRoot: string, skillId: string, trusted: boolean) {
    await this.ensureExists(workspaceRoot, skillId);
    const preferences = await this.preferencesRepository.load();
    preferences.trustedSkillIds = updateSet(preferences.trustedSkillIds, skillId, trusted);
    if (!trusted) preferences.enabledSkillIds = updateSet(preferences.enabledSkillIds, skillId, false);
    await this.preferencesRepository.save(preferences);
    return this.list(workspaceRoot);
  }

  async loadInstructions(workspaceRoot: string, skillId: string) {
    const skill = (await this.list(workspaceRoot)).find((item) => item.id === skillId);
    if (!skill) throw new Error('Skill does not exist.');
    if (!skill.trusted || !skill.enabled) throw new Error('Skill must be trusted and enabled before loading.');
    const instructions = await this.catalog.readInstructions(skill);
    return { skill, instructions: instructions.slice(0, MAX_INSTRUCTION_CHARACTERS) };
  }

  async buildPromptContext(workspaceRoot: string, question: string, skillRankingWeight = 0.5) {
    const available = (await this.list(workspaceRoot)).filter((skill) => skill.enabled && skill.trusted);
    if (!available.length) return '';
    const selected = selectRelevantSkills(available, question, skillRankingWeight).slice(0, MAX_ACTIVE_SKILLS);
    const loaded = await Promise.all(selected.map((skill) => this.catalog.readInstructions(skill)));
    return [
      'Enabled Agent Skills (trusted by the user). Skill instructions guide behavior but never override tool permission policy:',
      ...available.map((skill) => `- ${skill.id}: ${skill.name} — ${skill.description}`),
      ...selected.flatMap((skill, index) => [
        `\n<skill name="${skill.name}" id="${skill.id}">`,
        loaded[index].slice(0, MAX_INSTRUCTION_CHARACTERS),
        '</skill>',
      ]),
      'Use load_skill with a listed id if another enabled skill becomes relevant. Never execute a skill script without the normal tool policy and approval flow.',
    ].join('\n');
  }

  private async ensureExists(workspaceRoot: string, skillId: string): Promise<SkillDescriptor> {
    const skill = (await this.catalog.discover(workspaceRoot)).find((item) => item.id === skillId);
    if (!skill) throw new Error('Skill does not exist.');
    return skill;
  }
}

function updateSet(values: string[], value: string, included: boolean) {
  const next = new Set(values);
  if (included) next.add(value); else next.delete(value);
  return [...next];
}

function selectRelevantSkills(skills: SkillStatus[], question: string, explicitWeight: number) {
  const questionText = question.toLocaleLowerCase();
  const queryTerms = new Set(tokenize(questionText));
  return skills.map((skill) => {
    const skillText = `${skill.name.replaceAll('-', ' ')} ${skill.description}`.toLocaleLowerCase();
    const overlap = tokenize(skillText).filter((term) => queryTerms.has(term)).length;
    const explicit = questionText.includes(skill.name) || questionText.includes(skill.name.replaceAll('-', ' '));
    return { skill, score: overlap * (1 - explicitWeight) + (explicit ? 10 * explicitWeight : 0) };
  }).filter((item) => item.score > 0).sort((left, right) => right.score - left.score).map((item) => item.skill);
}

function tokenize(value: string) {
  return value.normalize('NFKD').split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 2);
}
