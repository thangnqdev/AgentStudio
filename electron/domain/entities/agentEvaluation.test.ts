import { describe, expect, it } from 'vitest';
import { assertEvaluationInvariant, type TaskEvaluation } from './agentEvaluation.js';

const evaluation: TaskEvaluation = {
  kind: 'task', score: 1, passed: true, statusMatched: true, expectedStatus: 'completed', observedStatus: 'completed',
  provenance: { runId: 'run-1', fixtureId: 'fixture-1', fixtureVersion: '1.0.0', evaluatorId: 'task-outcome', evaluatorVersion: '1.0.0', evaluatedAt: '2026-01-01T00:00:00.000Z' },
};

describe('agent evaluation invariants', () => {
  it('requires bounded scores and complete provenance', () => {
    expect(() => assertEvaluationInvariant(evaluation)).not.toThrow();
    expect(() => assertEvaluationInvariant({ ...evaluation, score: 1.1 })).toThrow('within [0,1]');
    expect(() => assertEvaluationInvariant({ ...evaluation, provenance: { ...evaluation.provenance, evaluatorVersion: '' } })).toThrow('provenance');
  });

  it('rejects non-allow-listed task content', () => {
    expect(() => assertEvaluationInvariant({ ...evaluation, prompt: 'private task' } as TaskEvaluation)).toThrow('non-allow-listed');
  });
});
