import type { SkillCandidate, SkillCandidateEvaluation } from '../entities/skillLearning.js';

export interface ISkillCandidateEvaluator { evaluate(candidate: Readonly<SkillCandidate>): Promise<SkillCandidateEvaluation>; }
