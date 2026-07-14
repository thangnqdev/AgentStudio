import { AGENT_EVALUATION_REPORT_VERSION, assertEvaluationInvariant, assertEvaluationReportInvariant, type AgentEvaluation, type AgentEvaluationReport, type GoldenTaskSuite } from '../../domain/entities/agentEvaluation.js';
import type { IAgentEvaluationReportRepository } from '../../domain/ports/IAgentEvaluationReportRepository.js';
import type { IAgentEvaluator } from '../../domain/ports/IAgentEvaluator.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import { assertOptimizationConfig, configurationDigest, type RuntimeOptimizationConfig } from '../../domain/entities/optimizer.js';

export class RunAgentEvaluationRegression {
  private readonly evaluators: IAgentEvaluator[];
  private readonly reports: IAgentEvaluationReportRepository;
  private readonly tracer?: IAgentTracer;

  constructor(
    evaluators: IAgentEvaluator[], reports: IAgentEvaluationReportRepository, tracer?: IAgentTracer,
  ) { this.evaluators = evaluators; this.reports = reports; this.tracer = tracer; }

  async execute(
    suite: GoldenTaskSuite,
    runtimeConfig: RuntimeOptimizationConfig,
  ): Promise<AgentEvaluationReport> {
    if (!suite.fixtures.length || !this.evaluators.length) throw new Error('Evaluation suite and evaluators are required.');
    assertOptimizationConfig(runtimeConfig);
    const runId = crypto.randomUUID();
    const evaluationTaskId = `evaluation-${runId}`;
    await this.tracer?.startTrace(runId, evaluationTaskId).catch(() => undefined);
    const evaluations: AgentEvaluation[] = [];
    for (const fixture of suite.fixtures) {
      for (const evaluator of this.evaluators) {
        const immutableFixture = deepFreeze(structuredClone(fixture));
        const before = JSON.stringify(immutableFixture);
        const startedAt = new Date().toISOString();
        const result = await evaluator.evaluate(immutableFixture, runId);
        if (JSON.stringify(immutableFixture) !== before) throw new Error(`${evaluator.id} mutated its evaluation fixture.`);
        if (result.kind !== evaluator.kind || result.provenance.evaluatorId !== evaluator.id || result.provenance.evaluatorVersion !== evaluator.version) throw new Error(`${evaluator.id} returned invalid provenance.`);
        const threshold = suite.minimumScores[result.kind] ?? suite.minimumAggregateScore;
        const evaluated = { ...result, passed: result.score >= threshold } as AgentEvaluation;
        assertEvaluationInvariant(evaluated);
        evaluations.push(evaluated);
        await this.tracer?.recordSpan({ kind: 'evaluation', traceId: runId, taskId: evaluationTaskId, startedAt, endedAt: new Date().toISOString(), status: evaluated.passed ? 'succeeded' : 'failed', evaluatorId: evaluator.id, evaluationVersion: evaluator.version, score: evaluated.score, provenanceId: `${fixture.id}@${fixture.version}` }).catch(() => undefined);
      }
    }
    const aggregateScore = evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / evaluations.length;
    const report: AgentEvaluationReport = {
      reportVersion: AGENT_EVALUATION_REPORT_VERSION, runId, suiteId: suite.id, suiteVersion: suite.version,
      createdAt: new Date().toISOString(), aggregateScore, passed: aggregateScore >= suite.minimumAggregateScore && evaluations.every((evaluation) => evaluation.passed), evaluations,
      runtimeConfiguration: {
        configurationDigest: configurationDigest(runtimeConfig),
        config: structuredClone(runtimeConfig),
      },
    };
    assertEvaluationReportInvariant(report);
    await this.reports.append(report);
    await this.tracer?.updateTrace(runId, evaluationTaskId, report.passed ? 'succeeded' : 'failed').catch(() => undefined);
    return report;
  }

  list(limit?: number) { return this.reports.list(limit); }
  exportJson(runId: string, targetPath: string) { return this.reports.exportJson(runId, targetPath); }
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
