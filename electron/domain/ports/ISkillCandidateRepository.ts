import type { SkillCandidate } from '../entities/skillLearning.js';

export interface ISkillCandidateRepository { list(): Promise<SkillCandidate[]>; save(candidate: SkillCandidate): Promise<void>; }
