import { IsolatedSkillCandidateEvaluator } from './application/services/IsolatedSkillCandidateEvaluator.js';
import { SkillLearning } from './application/usecases/SkillLearning.js';
import { JsonSkillCandidateRepository } from './infrastructure/skillLearning/JsonSkillCandidateRepository.js';
import { SignedSkillPromoter } from './infrastructure/skillLearning/SignedSkillPromoter.js';
import { JsonlAgentTraceRepository } from './infrastructure/tracing/JsonlAgentTraceRepository.js';

export const skillLearning = new SkillLearning(new JsonSkillCandidateRepository(), new JsonlAgentTraceRepository(), new IsolatedSkillCandidateEvaluator(), new SignedSkillPromoter());
