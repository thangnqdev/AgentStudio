import type { SkillCandidate, SkillPromotion } from '../entities/skillLearning.js';

export interface ISkillCandidatePromoter { promote(candidate: Readonly<SkillCandidate>): Promise<SkillPromotion>; }
