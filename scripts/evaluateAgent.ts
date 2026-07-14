import fs from 'node:fs/promises';
import path from 'node:path';
import { createDefaultAgentEvaluators } from '../electron/application/services/agentEvaluators.js';
import { BuildGoldenAgentRuntimeSuite } from '../electron/application/usecases/BuildGoldenAgentRuntimeSuite.js';
import { RunAgentEvaluationRegression } from '../electron/application/usecases/RunAgentEvaluationRegression.js';
import type { AgentEvaluationReport } from '../electron/domain/entities/agentEvaluation.js';
import type { IAgentEvaluationReportRepository } from '../electron/domain/ports/IAgentEvaluationReportRepository.js';
import { GOLDEN_AGENT_RUNTIME_SUITE } from '../electron/evaluation/goldenAgentSuite.js';
import { DeterministicAgentScenarioRunner } from '../electron/infrastructure/evaluation/DeterministicAgentScenarioRunner.js';

class CliReportRepository implements IAgentEvaluationReportRepository {
  reports: AgentEvaluationReport[] = [];
  async append(report: AgentEvaluationReport) { this.reports.push(report); }
  async list() { return this.reports; }
  async exportJson() {}
}

async function main() {
  const outputPath = process.argv[2];
  const suite = await new BuildGoldenAgentRuntimeSuite(new DeterministicAgentScenarioRunner()).execute(GOLDEN_AGENT_RUNTIME_SUITE);
  const report = await new RunAgentEvaluationRegression(createDefaultAgentEvaluators(), new CliReportRepository()).execute(suite);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) await fs.writeFile(path.resolve(outputPath), serialized, 'utf8');
  else process.stdout.write(serialized);
  process.stderr.write(`Deterministic agent runtime regression ${report.passed ? 'PASSED' : 'FAILED'} · score=${report.aggregateScore.toFixed(3)} · ${report.evaluations.length} evaluations\n`);
  if (!report.passed) process.exitCode = 1;
}

main().catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
