import { describe, expect, it } from 'vitest';
import { SKILL_CANDIDATE_VERSION, assertSkillCandidate, type SkillCandidate } from './skillLearning.js';

describe('skill candidate invariants', () => {
  it('accepts generated allow-listed candidate data', () => expect(() => assertSkillCandidate(candidate())).not.toThrow());
  it('rejects hidden content and mismatched approval provenance', () => {
    const value = candidate();
    expect(() => assertSkillCandidate({ ...value, toolArguments: { path: '/private' } } as typeof value)).toThrow('non-allow-listed');
    value.approval = { candidateDigest: 'wrong', decision: 'approved', approvedBy: 'local-user', decidedAt: new Date().toISOString() };
    expect(() => assertSkillCandidate(value)).toThrow('approval');
  });
});

function candidate(): SkillCandidate {
  return { schemaVersion: SKILL_CANDIDATE_VERSION, id: 'candidate-1', sourceTraceId: 'trace-1', sourceTraceStatus: 'succeeded', name: 'learned-trajectory-trace1', description: 'Sanitized tool sequence.', skillVersion: '1.0.0', instructions: 'Use the `read_file` tool and follow central policy.', toolSequence: ['read_file'], tests: [{ id: 'source-succeeded', version: 1, kind: 'source_succeeded', description: 'Source succeeded.' }], status: 'draft', createdAt: '2026-01-01T00:00:00.000Z' };
}
