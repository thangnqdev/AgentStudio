import { createDefaultAgentEvaluators } from './application/services/agentEvaluators.js';
import { BuildGoldenAgentRuntimeSuite } from './application/usecases/BuildGoldenAgentRuntimeSuite.js';
import { RunAgentEvaluationRegression } from './application/usecases/RunAgentEvaluationRegression.js';
import { GOLDEN_AGENT_RUNTIME_SUITE } from './evaluation/goldenAgentSuite.js';
import { DeterministicAgentScenarioRunner } from './infrastructure/evaluation/DeterministicAgentScenarioRunner.js';
import { JsonlAgentEvaluationReportRepository } from './infrastructure/evaluation/JsonlAgentEvaluationReportRepository.js';
import { agentTraceService } from './agentRuntime.js';
import { optimizerRepository } from './optimizerRuntime.js';

export const agentEvaluationRegression = new RunAgentEvaluationRegression(
  createDefaultAgentEvaluators(), new JsonlAgentEvaluationReportRepository(), agentTraceService,
);
const goldenAgentRuntimeSuiteBuilder = new BuildGoldenAgentRuntimeSuite(new DeterministicAgentScenarioRunner());

export async function runGoldenAgentRuntimeEvaluation(candidateId?: string) {
  const state = await optimizerRepository.load();
  const candidate = candidateId
    ? state.candidates.find((item) => item.id === candidateId)
    : undefined;
  if (candidateId && !candidate) throw new Error('Optimization candidate does not exist.');
  if (candidate && candidate.baseRevision !== state.revision) {
    throw new Error('Optimization candidate is stale; create a new candidate from the active revision.');
  }
  const config = structuredClone(candidate?.config ?? state.active);
  const suite = await goldenAgentRuntimeSuiteBuilder.execute(GOLDEN_AGENT_RUNTIME_SUITE, config);
  return agentEvaluationRegression.execute(suite, config);
}
