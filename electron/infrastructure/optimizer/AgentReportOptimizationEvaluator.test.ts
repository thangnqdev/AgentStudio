import { describe, expect, it } from 'vitest';
import type { AgentEvaluationReport } from '../../domain/entities/agentEvaluation.js';
import { DEFAULT_OPTIMIZATION_CONFIG } from '../../domain/entities/optimizer.js';
import type { IAgentEvaluationReportRepository } from '../../domain/ports/IAgentEvaluationReportRepository.js';
import { AgentReportOptimizationEvaluator } from './AgentReportOptimizationEvaluator.js';

describe('AgentReportOptimizationEvaluator', () => {
  it('compares persisted passing reports from the same suite and rejects ties', async () => {
    const reports = repository([report('candidate', 0.96), report('baseline', 0.95)]);
    const evaluator = new AgentReportOptimizationEvaluator(reports);
    expect((await evaluator.evaluate(DEFAULT_OPTIMIZATION_CONFIG, 'baseline', 'candidate')).passed).toBe(true);
    const tied = new AgentReportOptimizationEvaluator(repository([report('candidate', 0.95), report('baseline', 0.95)]));
    expect((await tied.evaluate(DEFAULT_OPTIMIZATION_CONFIG, 'baseline', 'candidate')).passed).toBe(false);
  });

  it('rejects failed or incomparable provenance', async () => {
    const evaluator = new AgentReportOptimizationEvaluator(repository([report('candidate', 0.96, 'other'), report('baseline', 0.95)]));
    await expect(evaluator.evaluate(DEFAULT_OPTIMIZATION_CONFIG, 'baseline', 'candidate')).rejects.toThrow('same versioned suite');
  });
});

function repository(reports: AgentEvaluationReport[]): IAgentEvaluationReportRepository { return { append: async () => undefined, list: async () => reports, exportJson: async () => undefined }; }
function report(runId: string, aggregateScore: number, suiteId = 'suite'): AgentEvaluationReport { return { reportVersion: 1, runId, suiteId, suiteVersion: '1.0.0', createdAt: '2026-01-01T00:00:00.000Z', aggregateScore, passed: true, evaluations: [] }; }
