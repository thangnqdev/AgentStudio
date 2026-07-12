import { OPTIMIZER_EVALUATION_VERSION, configurationDigest, type OptimizationEvaluation, type RuntimeOptimizationConfig } from '../../domain/entities/optimizer.js';
import type { IAgentEvaluationReportRepository } from '../../domain/ports/IAgentEvaluationReportRepository.js';
import type { IOptimizationEvaluator } from '../../domain/ports/IOptimizationEvaluator.js';

const MINIMUM_IMPROVEMENT = 0.001;

export class AgentReportOptimizationEvaluator implements IOptimizationEvaluator {
  private readonly reports: IAgentEvaluationReportRepository;
  constructor(reports: IAgentEvaluationReportRepository) { this.reports = reports; }

  async evaluate(config: RuntimeOptimizationConfig, baselineRunId: string, candidateRunId: string): Promise<OptimizationEvaluation> {
    if (!baselineRunId || !candidateRunId || baselineRunId === candidateRunId) throw new Error('Two distinct evaluation report IDs are required.');
    const reports = await this.reports.list(200);
    const baseline = reports.find((report) => report.runId === baselineRunId); const candidate = reports.find((report) => report.runId === candidateRunId);
    if (!baseline || !candidate) throw new Error('Both evaluation reports must exist.');
    if (!baseline.passed || !candidate.passed) throw new Error('Both evaluation reports must pass their suite gates.');
    if (baseline.suiteId !== candidate.suiteId || baseline.suiteVersion !== candidate.suiteVersion) throw new Error('Evaluation reports must use the same versioned suite.');
    const improvement = candidate.aggregateScore - baseline.aggregateScore;
    return {
      version: OPTIMIZER_EVALUATION_VERSION, evaluatorId: 'agent-report-comparator', evaluatorVersion: '1.0.0', baselineRunId, candidateRunId,
      baselineScore: baseline.aggregateScore, candidateScore: candidate.aggregateScore, improvement, minimumImprovement: MINIMUM_IMPROVEMENT,
      passed: improvement >= MINIMUM_IMPROVEMENT, configurationDigest: configurationDigest(config), evaluatedAt: new Date().toISOString(),
    };
  }
}
