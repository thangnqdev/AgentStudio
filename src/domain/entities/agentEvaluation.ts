export type EvaluationKind = 'task' | 'tool_selection' | 'code_change' | 'policy' | 'trajectory' | 'retrieval';
export type AgentEvaluation = {
  kind: EvaluationKind; score: number; passed: boolean;
  provenance: { runId: string; fixtureId: string; fixtureVersion: string; evaluatorId: string; evaluatorVersion: string; evaluatedAt: string };
  precision?: number; recall?: number; forbiddenToolCalls?: number; violationCount?: number; checkCount?: number;
  stepCount?: number; maxSteps?: number; failedToolCalls?: number; recallAtK?: number; reciprocalRank?: number; ndcgAtK?: number;
};
export type AgentEvaluationReport = {
  reportVersion: 1 | 2; runId: string; suiteId: string; suiteVersion: string; createdAt: string;
  aggregateScore: number; passed: boolean; evaluations: AgentEvaluation[];
  runtimeConfiguration?: { configurationDigest: string; config: RuntimeOptimizationConfig };
};
import type { RuntimeOptimizationConfig } from './optimizer';
