import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assertEvaluationReportInvariant, type AgentEvaluationReport } from '../../domain/entities/agentEvaluation.js';
import type { IAgentEvaluationReportRepository } from '../../domain/ports/IAgentEvaluationReportRepository.js';

export class JsonlAgentEvaluationReportRepository implements IAgentEvaluationReportRepository {
  private queue = Promise.resolve();
  private readonly configuredPath?: string;
  constructor(configuredPath?: string) { this.configuredPath = configuredPath; }

  append(report: AgentEvaluationReport) {
    assertEvaluationReportInvariant(report);
    const operation = this.queue.then(async () => {
      await fs.mkdir(path.dirname(this.getPath()), { recursive: true });
      await fs.appendFile(this.getPath(), `${JSON.stringify(report)}\n`, { encoding: 'utf8', mode: 0o600 });
      await fs.chmod(this.getPath(), 0o600).catch(() => undefined);
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  async list(limit = 50) {
    const reports = await this.read();
    return reports.sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, Math.min(Math.max(limit, 1), 200));
  }

  async exportJson(reportId: string, targetPath: string) {
    const report = (await this.read()).find((item) => item.runId === reportId);
    if (!report) throw new Error('Evaluation report does not exist.');
    await fs.writeFile(targetPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await fs.chmod(targetPath, 0o600).catch(() => undefined);
  }

  private async read() {
    await this.queue;
    try {
      return (await fs.readFile(this.getPath(), 'utf8')).split('\n').filter(Boolean).flatMap((line): AgentEvaluationReport[] => {
        try { const report = JSON.parse(line) as AgentEvaluationReport; assertEvaluationReportInvariant(report); return [report]; } catch { return []; }
      });
    } catch { return []; }
  }

  private getPath() { return this.configuredPath ?? path.join(app.getPath('userData'), 'evaluations', 'agent-evaluation-reports.jsonl'); }
}
