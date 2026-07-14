import type { SkillStatus } from '../../domain/entities/skill.js';

export function rankRelevantSkills(skills: SkillStatus[], question: string, explicitWeight: number) {
  const questionText = question.toLocaleLowerCase();
  const queryTerms = new Set(tokenize(questionText));
  return skills.map((skill) => {
    const skillText = `${skill.name.replaceAll('-', ' ')} ${skill.description}`.toLocaleLowerCase();
    const overlap = tokenize(skillText).filter((term) => queryTerms.has(term)).length;
    const explicit = questionText.includes(skill.name) || questionText.includes(skill.name.replaceAll('-', ' '));
    return { skill, score: overlap * (1 - explicitWeight) + (explicit ? 10 * explicitWeight : 0) };
  }).filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.skill);
}

function tokenize(value: string) {
  return value.normalize('NFKD').split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 2);
}
