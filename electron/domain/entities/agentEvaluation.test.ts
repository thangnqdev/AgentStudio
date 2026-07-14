import { describe, expect, it } from 'vitest';
import { DEFAULT_OPTIMIZATION_CONFIG, configurationDigest } from './optimizer.js';
import {
  assertEvaluationInvariant,
  assertEvaluationReportInvariant,
  type AgentEvaluationReport,
  type TaskEvaluation,
} from './agentEvaluation.js';

const evaluation: TaskEvaluation = {
  kind: 'task', score: 1, passed: true, statusMatched: true, expectedStatus: 'completed', observedStatus: 'completed',
  provenance: { runId: 'run-1', fixtureId: 'fixture-1', fixtureVersion: '1.0.0', evaluatorId: 'task-outcome', evaluatorVersion: '1.0.0', evaluatedAt: '2026-01-01T00:00:00.000Z' },
};

describe('evaluation report invariant', () => {
  it('requires bounded scores and complete provenance', () => {
    expect(() => assertEvaluationInvariant(evaluation)).not.toThrow();
    expect(() => assertEvaluationInvariant({ ...evaluation, score: 1.1 })).toThrow('within [0,1]');
    expect(() => assertEvaluationInvariant({ ...evaluation, provenance: { ...evaluation.provenance, evaluatorVersion: '' } })).toThrow('provenance');
  });

  it('rejects non-allow-listed task content', () => {
    expect(() => assertEvaluationInvariant({ ...evaluation, prompt: 'private task' } as TaskEvaluation)).toThrow('non-allow-listed');
  });

  it('accepts version 2 runtime evidence and detects a tampered digest', () => {
    const report = versionTwoReport();
    expect(() => assertEvaluationReportInvariant(report)).not.toThrow();
    const tampered = structuredClone(report);
    if (tampered.reportVersion !== 2) throw new Error('Expected version 2 report.');
    tampered.runtimeConfiguration.configurationDigest = 'wrong';
    expect(() => assertEvaluationReportInvariant(tampered)).toThrow('digest');
  });

  it('keeps legacy reports readable but without optimizer evidence', () => {
    const current = versionTwoReport();
    const legacy: AgentEvaluationReport = {
      reportVersion: 1,
      runId: current.runId,
      suiteId: current.suiteId,
      suiteVersion: current.suiteVersion,
      createdAt: current.createdAt,
      aggregateScore: current.aggregateScore,
      passed: current.passed,
      evaluations: current.evaluations,
    };
    expect(() => assertEvaluationReportInvariant(legacy)).not.toThrow();
  });
});

function versionTwoReport(): AgentEvaluationReport {
  return {
    reportVersion: 2,
    runId: 'run-1234567890123456',
    suiteId: 'suite',
    suiteVersion: '1.0.0',
    createdAt: '2026-01-01T00:00:00.000Z',
    aggregateScore: 1,
    passed: true,
    evaluations: [{
      kind: 'task',
      score: 1,
      passed: true,
      statusMatched: true,
      expectedStatus: 'completed',
      observedStatus: 'completed',
      provenance: {
        runId: 'run-1234567890123456',
        fixtureId: 'fixture',
        fixtureVersion: '1.0.0',
        evaluatorId: 'task',
        evaluatorVersion: '1.0.0',
        evaluatedAt: '2026-01-01T00:00:00.000Z',
      },
    }],
    runtimeConfiguration: {
      configurationDigest: configurationDigest(DEFAULT_OPTIMIZATION_CONFIG),
      config: structuredClone(DEFAULT_OPTIMIZATION_CONFIG),
    },
  };
}
