import type { AgentEvaluationReport } from '../entities/agentEvaluation.js';

export interface IAgentEvaluationReportRepository {
  append(report: AgentEvaluationReport): Promise<void>;
  list(limit?: number): Promise<AgentEvaluationReport[]>;
  exportJson(reportId: string, targetPath: string): Promise<void>;
}
