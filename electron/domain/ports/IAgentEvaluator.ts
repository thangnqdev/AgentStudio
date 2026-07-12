import type { AgentEvaluation, EvaluationKind, GoldenTaskFixture } from '../entities/agentEvaluation.js';

export interface IAgentEvaluator {
  readonly id: string;
  readonly version: string;
  readonly kind: EvaluationKind;
  evaluate(fixture: Readonly<GoldenTaskFixture>, runId: string): Promise<AgentEvaluation>;
}
