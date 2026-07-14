import { createDefaultAgentEvaluators } from './application/services/agentEvaluators.js';
import { BuildGoldenAgentRuntimeSuite } from './application/usecases/BuildGoldenAgentRuntimeSuite.js';
import { RunAgentEvaluationRegression } from './application/usecases/RunAgentEvaluationRegression.js';
import { GOLDEN_AGENT_RUNTIME_SUITE } from './evaluation/goldenAgentSuite.js';
import { DeterministicAgentScenarioRunner } from './infrastructure/evaluation/DeterministicAgentScenarioRunner.js';
import { JsonlAgentEvaluationReportRepository } from './infrastructure/evaluation/JsonlAgentEvaluationReportRepository.js';
import { agentTraceService } from './agentRuntime.js';

export const agentEvaluationRegression = new RunAgentEvaluationRegression(
  createDefaultAgentEvaluators(), new JsonlAgentEvaluationReportRepository(), agentTraceService,
);
const goldenAgentRuntimeSuiteBuilder = new BuildGoldenAgentRuntimeSuite(new DeterministicAgentScenarioRunner());

export async function runGoldenAgentRuntimeEvaluation() {
  const suite = await goldenAgentRuntimeSuiteBuilder.execute(GOLDEN_AGENT_RUNTIME_SUITE);
  return agentEvaluationRegression.execute(suite);
}
