import type { GoldenRuntimeTaskDefinition, GoldenTaskFixture } from '../entities/agentEvaluation.js';
import type { RuntimeOptimizationConfig } from '../entities/optimizer.js';

export interface IAgentEvaluationScenarioRunner {
  run(
    definition: Readonly<GoldenRuntimeTaskDefinition>,
    config: Readonly<RuntimeOptimizationConfig>,
  ): Promise<GoldenTaskFixture['observed']>;
}
