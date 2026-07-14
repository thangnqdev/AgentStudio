import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentSpanInput } from '../../domain/entities/agentTrace.js';
import { AGENT_EVALUATOR_FIXTURE_SUITE } from '../../evaluation/goldenAgentSuite.js';
import { createDefaultAgentEvaluators } from '../../application/services/agentEvaluators.js';
import { RunAgentEvaluationRegression } from '../../application/usecases/RunAgentEvaluationRegression.js';
import { JsonlAgentEvaluationReportRepository } from './JsonlAgentEvaluationReportRepository.js';
import { DEFAULT_OPTIMIZATION_CONFIG } from '../../domain/entities/optimizer.js';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true }))));

describe('agent evaluation regression integration', () => {
  it('persists reports, exports JSON and emits evaluation traces', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-evaluation-')); directories.push(directory);
    const repository = new JsonlAgentEvaluationReportRepository(path.join(directory, 'reports.jsonl'));
    const spans: AgentSpanInput[] = [];
    const tracer = { newSpanId: () => crypto.randomUUID(), startTrace: async () => undefined, updateTrace: async () => undefined, recordSpan: async (span: AgentSpanInput) => { spans.push(span); return crypto.randomUUID(); } };
    const runner = new RunAgentEvaluationRegression(createDefaultAgentEvaluators(), repository, tracer);
    const report = await runner.execute(AGENT_EVALUATOR_FIXTURE_SUITE, DEFAULT_OPTIMIZATION_CONFIG);
    const target = path.join(directory, 'report.json'); await runner.exportJson(report.runId, target);
    expect((await repository.list())[0].runId).toBe(report.runId);
    expect(JSON.parse(await fs.readFile(target, 'utf8')).passed).toBe(true);
    expect(spans).toHaveLength(report.evaluations.length);
    expect(spans.every((span) => span.kind === 'evaluation' && Boolean(span.provenanceId))).toBe(true);
  });
});
