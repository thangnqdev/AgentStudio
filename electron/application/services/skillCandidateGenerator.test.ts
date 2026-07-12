import { describe, expect, it } from 'vitest';
import { generateSkillCandidate } from './skillCandidateGenerator.js';
import { successfulTrace } from '../../test/fixtures/skillLearningTrace.js';

describe('generateSkillCandidate', () => {
  it('creates tests and instructions only from sanitized successful tool metadata', () => {
    const candidate = generateSkillCandidate(successfulTrace(), 'candidate-1', '2026-01-01T00:00:00.000Z');
    expect(candidate.toolSequence).toEqual(['read_file', 'apply_patch']);
    expect(candidate.tests.map((test) => test.kind)).toEqual(['source_succeeded', 'tool_sequence_represented', 'bounded_instructions', 'no_policy_override']);
    expect(candidate.instructions).toContain('`read_file`'); expect(candidate.instructions).not.toContain('private content'); expect(candidate.instructions).not.toContain('/workspace');
  });
  it('rejects failed or tool-free trajectories', () => {
    expect(() => generateSkillCandidate(successfulTrace('failed'), 'candidate-1', new Date().toISOString())).toThrow('succeeded');
    const empty = successfulTrace(); empty.spans = [];
    expect(() => generateSkillCandidate(empty, 'candidate-1', new Date().toISOString())).toThrow('no reusable');
  });
});
