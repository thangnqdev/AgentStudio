import { assertSkillCandidate, skillCandidateDigest, type SkillCandidate } from '../../domain/entities/skillLearning.js';
import type { IAgentTraceRepository } from '../../domain/ports/IAgentTraceRepository.js';
import type { ISkillCandidateEvaluator } from '../../domain/ports/ISkillCandidateEvaluator.js';
import type { ISkillCandidatePromoter } from '../../domain/ports/ISkillCandidatePromoter.js';
import type { ISkillCandidateRepository } from '../../domain/ports/ISkillCandidateRepository.js';
import { generateSkillCandidate } from '../services/skillCandidateGenerator.js';

export class SkillLearning {
  private readonly candidates: ISkillCandidateRepository; private readonly traces: Pick<IAgentTraceRepository, 'get'>;
  private readonly evaluator: ISkillCandidateEvaluator; private readonly promoter: ISkillCandidatePromoter; private queue = Promise.resolve();
  constructor(candidates: ISkillCandidateRepository, traces: Pick<IAgentTraceRepository, 'get'>, evaluator: ISkillCandidateEvaluator, promoter: ISkillCandidatePromoter) { this.candidates = candidates; this.traces = traces; this.evaluator = evaluator; this.promoter = promoter; }

  async list() { const candidates = await this.candidates.list(); candidates.forEach(assertSkillCandidate); return structuredClone(candidates); }

  createFromTrace(traceId: string) {
    return this.exclusive(async () => {
      const existing = (await this.candidates.list()).find((candidate) => candidate.sourceTraceId === traceId);
      if (existing) return structuredClone(existing);
      const trace = await this.traces.get(traceId); if (!trace) throw new Error('Source trace does not exist.');
      const candidate = generateSkillCandidate(trace, crypto.randomUUID(), new Date().toISOString()); assertSkillCandidate(candidate);
      await this.candidates.save(candidate); return structuredClone(candidate);
    });
  }

  evaluate(candidateId: string) {
    return this.exclusive(async () => {
      const candidate = await this.find(candidateId); if (candidate.approval || candidate.status === 'approved' || candidate.status === 'promoted') throw new Error('Decided or promoted candidate cannot be evaluated again.');
      const snapshot = structuredClone(candidate); const before = JSON.stringify(snapshot); const evaluation = await this.evaluator.evaluate(snapshot);
      if (JSON.stringify(snapshot) !== before || evaluation.candidateDigest !== skillCandidateDigest(candidate)) throw new Error('Skill evaluator returned invalid candidate provenance.');
      candidate.evaluation = evaluation; candidate.status = evaluation.passed ? 'evaluated' : 'rejected'; await this.save(candidate); return structuredClone(candidate);
    });
  }

  decide(candidateId: string, approved: boolean) {
    return this.exclusive(async () => {
      const candidate = await this.find(candidateId); if (!candidate.evaluation?.passed) throw new Error('Candidate must pass generated tests before approval.');
      candidate.approval = { candidateDigest: skillCandidateDigest(candidate), decision: approved ? 'approved' : 'rejected', approvedBy: 'local-user', decidedAt: new Date().toISOString() };
      candidate.status = approved ? 'approved' : 'rejected'; await this.save(candidate); return structuredClone(candidate);
    });
  }

  promote(candidateId: string) {
    return this.exclusive(async () => {
      const candidate = await this.find(candidateId); if (candidate.status !== 'approved' || candidate.approval?.decision !== 'approved' || !candidate.evaluation?.passed) throw new Error('Candidate requires passing evaluation and explicit local-user approval.');
      candidate.promotion = await this.promoter.promote(structuredClone(candidate)); candidate.status = 'promoted'; await this.save(candidate); return structuredClone(candidate);
    });
  }

  private async find(id: string) { const candidate = (await this.candidates.list()).find((item) => item.id === id); if (!candidate) throw new Error('Skill candidate does not exist.'); assertSkillCandidate(candidate); return structuredClone(candidate); }
  private async save(candidate: SkillCandidate) { assertSkillCandidate(candidate); await this.candidates.save(candidate); }
  private exclusive<T>(operation: () => Promise<T>): Promise<T> { const next = this.queue.then(operation); this.queue = next.then(() => undefined, () => undefined); return next; }
}
