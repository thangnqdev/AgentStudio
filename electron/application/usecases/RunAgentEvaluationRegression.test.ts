import { describe, expect, it } from 'vitest';
import type { AgentEvaluationReport, GoldenTaskFixture } from '../../domain/entities/agentEvaluation.js';
import type { IAgentEvaluator } from '../../domain/ports/IAgentEvaluator.js';
import { AGENT_EVALUATOR_FIXTURE_SUITE } from '../../evaluation/goldenAgentSuite.js';
import { createDefaultAgentEvaluators } from '../services/agentEvaluators.js';
import { RunAgentEvaluationRegression } from './RunAgentEvaluationRegression.js';

describe('RunAgentEvaluationRegression', () => {
  it('passes the golden suite and persists a versioned report', async () => {
    const reports: AgentEvaluationReport[] = [];
    const runner = new RunAgentEvaluationRegression(createDefaultAgentEvaluators(), { append: async (report) => { reports.push(report); }, list: async () => reports, exportJson: async () => undefined });
    const report = await runner.execute(AGENT_EVALUATOR_FIXTURE_SUITE);
    expect(report.passed).toBe(true);
    expect(report.reportVersion).toBe(1);
    expect(report.evaluations).toHaveLength(AGENT_EVALUATOR_FIXTURE_SUITE.fixtures.length * 6);
    expect(reports).toEqual([report]);
  });

  it('deep-freezes evaluator input and leaves the source fixture unchanged', async () => {
    const original = structuredClone(AGENT_EVALUATOR_FIXTURE_SUITE);
    const mutatingEvaluator: IAgentEvaluator = {
      id: 'mutator', version: '1.0.0', kind: 'task',
      async evaluate(fixture: Readonly<GoldenTaskFixture>) {
        (fixture.observed as GoldenTaskFixture['observed']).taskStatus = 'failed';
        throw new Error('mutation should be unreachable');
      },
    };
    const runner = new RunAgentEvaluationRegression([mutatingEvaluator], { append: async () => undefined, list: async () => [], exportJson: async () => undefined });
    await expect(runner.execute(AGENT_EVALUATOR_FIXTURE_SUITE)).rejects.toThrow();
    expect(AGENT_EVALUATOR_FIXTURE_SUITE).toEqual(original);
  });
});
