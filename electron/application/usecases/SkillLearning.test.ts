import { describe, expect, it } from 'vitest';
import { IsolatedSkillCandidateEvaluator } from '../services/IsolatedSkillCandidateEvaluator.js';
import { successfulTrace } from '../../test/fixtures/skillLearningTrace.js';
import type { SkillCandidate } from '../../domain/entities/skillLearning.js';
import { SkillLearning } from './SkillLearning.js';

describe('SkillLearning integration', () => {
  it('requires successful trace, generated tests, human approval and signed promotion in order', async () => {
    const values: SkillCandidate[] = []; let promotionCalls = 0;
    const learning = new SkillLearning({ list: async () => structuredClone(values), save: async (candidate) => { const index = values.findIndex((item) => item.id === candidate.id); if (index >= 0) values[index] = structuredClone(candidate); else values.push(structuredClone(candidate)); } }, { get: async () => successfulTrace() }, new IsolatedSkillCandidateEvaluator(), { promote: async (candidate) => { promotionCalls += 1; return { skillName: candidate.name, skillVersion: candidate.skillVersion, algorithm: 'hmac-sha256', signature: 'signed', candidateDigest: candidate.evaluation!.candidateDigest, promotedAt: new Date().toISOString() }; } });
    const candidate = await learning.createFromTrace('trace-private-task');
    await expect(learning.promote(candidate.id)).rejects.toThrow('explicit');
    const evaluated = await learning.evaluate(candidate.id); expect(evaluated.status).toBe('evaluated');
    const approved = await learning.decide(candidate.id, true); expect(approved.approval).toMatchObject({ decision: 'approved', approvedBy: 'local-user' });
    const promoted = await learning.promote(candidate.id); expect(promoted.status).toBe('promoted'); expect(promotionCalls).toBe(1);
    expect(await learning.createFromTrace('trace-private-task')).toMatchObject({ id: candidate.id, status: 'promoted' });
  });
  it('does not promote an explicit rejection', async () => {
    const values: SkillCandidate[] = []; const learning = new SkillLearning({ list: async () => structuredClone(values), save: async (candidate) => { values[0] = structuredClone(candidate); } }, { get: async () => successfulTrace() }, new IsolatedSkillCandidateEvaluator(), { promote: async () => { throw new Error('must not run'); } });
    const candidate = await learning.createFromTrace('trace-private-task'); await learning.evaluate(candidate.id); await learning.decide(candidate.id, false);
    await expect(learning.promote(candidate.id)).rejects.toThrow('explicit');
  });
});
