export const AGENT_EVALUATION_REPORT_VERSION = 1;
export type EvaluationKind = 'task' | 'tool_selection' | 'code_change' | 'policy' | 'trajectory' | 'retrieval';

export type EvaluationProvenance = {
  runId: string; fixtureId: string; fixtureVersion: string; evaluatorId: string; evaluatorVersion: string; evaluatedAt: string;
};

type EvaluationBase = { kind: EvaluationKind; score: number; passed: boolean; provenance: EvaluationProvenance };
export type TaskEvaluation = EvaluationBase & { kind: 'task'; statusMatched: boolean; expectedStatus: string; observedStatus: string };
export type ToolSelectionEvaluation = EvaluationBase & { kind: 'tool_selection'; precision: number; recall: number; forbiddenToolCalls: number };
export type CodeChangeEvaluation = EvaluationBase & { kind: 'code_change'; expectedFileCount: number; matchedFileCount: number; unexpectedFileCount: number; testsPassed: boolean };
export type PolicyEvaluation = EvaluationBase & { kind: 'policy'; checkCount: number; violationCount: number };
export type TrajectoryEvaluation = EvaluationBase & { kind: 'trajectory'; stepCount: number; maxSteps: number; failedToolCalls: number; terminal: boolean };
export type RetrievalEvaluation = EvaluationBase & { kind: 'retrieval'; recallAtK: number; reciprocalRank: number; ndcgAtK: number };
export type AgentEvaluation = TaskEvaluation | ToolSelectionEvaluation | CodeChangeEvaluation | PolicyEvaluation | TrajectoryEvaluation | RetrievalEvaluation;

export type GoldenTaskFixture = {
  id: string;
  version: string;
  expected: {
    taskStatus: 'completed' | 'paused' | 'failed'; tools: string[]; forbiddenTools: string[]; changedFiles: string[];
    testsMustPass: boolean; maxSteps: number; maxFailedToolCalls: number; relevantChunkIds: string[];
  };
  observed: {
    taskId: string; traceId: string; taskStatus: 'completed' | 'paused' | 'failed'; completedSteps: number;
    toolCalls: Array<{ toolName: string; outcome: 'succeeded' | 'failed' | 'denied' | 'blocked' }>;
    changedFiles: string[]; testsPassed: boolean; policyViolationCodes: string[]; retrievedChunkIds: string[];
  };
};

export type GoldenTaskSuite = {
  id: string; version: string; minimumAggregateScore: number; minimumScores: Partial<Record<EvaluationKind, number>>; fixtures: GoldenTaskFixture[];
};

export type AgentEvaluationReport = {
  reportVersion: typeof AGENT_EVALUATION_REPORT_VERSION; runId: string; suiteId: string; suiteVersion: string; createdAt: string;
  aggregateScore: number; passed: boolean; evaluations: AgentEvaluation[];
};

export function assertEvaluationInvariant(evaluation: AgentEvaluation) {
  const kindKeys: Record<EvaluationKind, string[]> = {
    task: ['statusMatched', 'expectedStatus', 'observedStatus'], tool_selection: ['precision', 'recall', 'forbiddenToolCalls'],
    code_change: ['expectedFileCount', 'matchedFileCount', 'unexpectedFileCount', 'testsPassed'], policy: ['checkCount', 'violationCount'],
    trajectory: ['stepCount', 'maxSteps', 'failedToolCalls', 'terminal'], retrieval: ['recallAtK', 'reciprocalRank', 'ndcgAtK'],
  };
  assertOnlyKeys(evaluation, ['kind', 'score', 'passed', 'provenance', ...kindKeys[evaluation.kind]]);
  if (!Number.isFinite(evaluation.score) || evaluation.score < 0 || evaluation.score > 1) throw new Error('Evaluation score must be within [0,1].');
  const provenance = evaluation.provenance;
  assertOnlyKeys(provenance, ['runId', 'fixtureId', 'fixtureVersion', 'evaluatorId', 'evaluatorVersion', 'evaluatedAt']);
  if (!provenance.runId || !provenance.fixtureId || !provenance.fixtureVersion || !provenance.evaluatorId || !provenance.evaluatorVersion || !Number.isFinite(Date.parse(provenance.evaluatedAt))) throw new Error('Evaluation provenance is incomplete.');
}

export function assertEvaluationReportInvariant(report: AgentEvaluationReport) {
  assertOnlyKeys(report, ['reportVersion', 'runId', 'suiteId', 'suiteVersion', 'createdAt', 'aggregateScore', 'passed', 'evaluations']);
  if (report.reportVersion !== AGENT_EVALUATION_REPORT_VERSION || !report.runId || !report.suiteId || !report.suiteVersion) throw new Error('Evaluation report identity is invalid.');
  if (!Number.isFinite(report.aggregateScore) || report.aggregateScore < 0 || report.aggregateScore > 1 || !Number.isFinite(Date.parse(report.createdAt)) || report.evaluations.length === 0) throw new Error('Evaluation report invariant failed.');
  report.evaluations.forEach(assertEvaluationInvariant);
}

function assertOnlyKeys(value: object, allowedKeys: string[]) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error('Evaluation contains non-allow-listed data.');
}
