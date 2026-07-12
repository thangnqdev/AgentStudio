import { createDefaultAgentEvaluators } from './application/services/agentEvaluators.js';
import { RunAgentEvaluationRegression } from './application/usecases/RunAgentEvaluationRegression.js';
import { GOLDEN_AGENT_SUITE } from './evaluation/goldenAgentSuite.js';
import { JsonlAgentEvaluationReportRepository } from './infrastructure/evaluation/JsonlAgentEvaluationReportRepository.js';
import { agentTraceService } from './agentRuntime.js';

export const agentEvaluationRegression = new RunAgentEvaluationRegression(
  createDefaultAgentEvaluators(), new JsonlAgentEvaluationReportRepository(), agentTraceService,
);
export const goldenAgentSuite = GOLDEN_AGENT_SUITE;
