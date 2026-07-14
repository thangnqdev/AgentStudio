import type { GoldenRuntimeTaskDefinition, GoldenTaskFixture } from '../entities/agentEvaluation.js';

export interface IAgentEvaluationScenarioRunner {
  run(definition: Readonly<GoldenRuntimeTaskDefinition>): Promise<GoldenTaskFixture['observed']>;
}
