import type {
  GoldenRuntimeSuiteDefinition,
  GoldenTaskSuite,
} from '../../domain/entities/agentEvaluation.js';
import type { IAgentEvaluationScenarioRunner } from '../../domain/ports/IAgentEvaluationScenarioRunner.js';

export class BuildGoldenAgentRuntimeSuite {
  private readonly scenarioRunner: IAgentEvaluationScenarioRunner;

  constructor(scenarioRunner: IAgentEvaluationScenarioRunner) {
    this.scenarioRunner = scenarioRunner;
  }

  async execute(definition: Readonly<GoldenRuntimeSuiteDefinition>): Promise<GoldenTaskSuite> {
    if (!definition.fixtures.length) throw new Error('At least one runtime evaluation scenario is required.');
    const fixtures = await Promise.all(definition.fixtures.map(async (fixture) => ({
      id: fixture.id,
      version: fixture.version,
      expected: structuredClone(fixture.expected),
      observed: await this.scenarioRunner.run(fixture),
    })));
    return {
      id: definition.id,
      version: definition.version,
      minimumAggregateScore: definition.minimumAggregateScore,
      minimumScores: structuredClone(definition.minimumScores),
      fixtures,
    };
  }
}
