import { describe, expect, it } from 'vitest';
import type { AgentEvaluationReport } from '../../domain/entities/agentEvaluation.js';
import {
  DEFAULT_OPTIMIZATION_CONFIG,
  configurationDigest,
  type RuntimeOptimizationConfig,
} from '../../domain/entities/optimizer.js';
import type { IAgentEvaluationReportRepository } from '../../domain/ports/IAgentEvaluationReportRepository.js';
import { AgentReportOptimizationEvaluator } from './AgentReportOptimizationEvaluator.js';

const CANDIDATE_CONFIG = { ...DEFAULT_OPTIMIZATION_CONFIG, retrievalTopK: 6 };

describe('AgentReportOptimizationEvaluator', () => {
  it('compares passing reports from the same suite and matching configurations', async () => {
    const reports = repository([
      report('candidate', 0.96, CANDIDATE_CONFIG),
      report('baseline', 0.95, DEFAULT_OPTIMIZATION_CONFIG),
    ]);
    const evaluator = new AgentReportOptimizationEvaluator(reports);

    expect((await evaluator.evaluate(
      DEFAULT_OPTIMIZATION_CONFIG,
      CANDIDATE_CONFIG,
      'baseline',
      'candidate',
    )).passed).toBe(true);
  });

  it('rejects ties and incomparable suites', async () => {
    const tied = new AgentReportOptimizationEvaluator(repository([
      report('candidate', 0.95, CANDIDATE_CONFIG),
      report('baseline', 0.95, DEFAULT_OPTIMIZATION_CONFIG),
    ]));
    expect((await tied.evaluate(DEFAULT_OPTIMIZATION_CONFIG, CANDIDATE_CONFIG, 'baseline', 'candidate')).passed).toBe(false);

    const incomparable = new AgentReportOptimizationEvaluator(repository([
      report('candidate', 0.96, CANDIDATE_CONFIG, 'other'),
      report('baseline', 0.95, DEFAULT_OPTIMIZATION_CONFIG),
    ]));
    await expect(incomparable.evaluate(DEFAULT_OPTIMIZATION_CONFIG, CANDIDATE_CONFIG, 'baseline', 'candidate'))
      .rejects.toThrow('same versioned suite');
  });

  it('rejects legacy or mismatched candidate configuration evidence', async () => {
    const legacy = legacyReport('candidate', 0.96);
    const legacyEvaluator = new AgentReportOptimizationEvaluator(repository([
      legacy,
      report('baseline', 0.95, DEFAULT_OPTIMIZATION_CONFIG),
    ]));
    await expect(legacyEvaluator.evaluate(DEFAULT_OPTIMIZATION_CONFIG, CANDIDATE_CONFIG, 'baseline', 'candidate'))
      .rejects.toThrow('lacks versioned runtime configuration evidence');

    const mismatched = new AgentReportOptimizationEvaluator(repository([
      report('candidate', 0.96, DEFAULT_OPTIMIZATION_CONFIG),
      report('baseline', 0.95, DEFAULT_OPTIMIZATION_CONFIG),
    ]));
    await expect(mismatched.evaluate(DEFAULT_OPTIMIZATION_CONFIG, CANDIDATE_CONFIG, 'baseline', 'candidate'))
      .rejects.toThrow('not executed with the expected optimizer configuration');
  });
});

function repository(reports: AgentEvaluationReport[]): IAgentEvaluationReportRepository {
  return { append: async () => undefined, list: async () => reports, exportJson: async () => undefined };
}

function report(
  runId: string,
  aggregateScore: number,
  config: RuntimeOptimizationConfig,
  suiteId = 'suite',
): AgentEvaluationReport {
  return {
    ...legacyReport(runId, aggregateScore, suiteId),
    reportVersion: 2,
    runtimeConfiguration: { configurationDigest: configurationDigest(config), config: structuredClone(config) },
  };
}

function legacyReport(runId: string, aggregateScore: number, suiteId = 'suite'): AgentEvaluationReport {
  return {
    reportVersion: 1,
    runId,
    suiteId,
    suiteVersion: '1.0.0',
    createdAt: '2026-01-01T00:00:00.000Z',
    aggregateScore,
    passed: true,
    evaluations: [],
  };
}
