import { describe, expect, it } from 'vitest';
import { AGENT_EVALUATOR_FIXTURE_SUITE } from '../../evaluation/goldenAgentSuite.js';
import { createDefaultAgentEvaluators } from './agentEvaluators.js';

describe('agent evaluators', () => {
  it('produce versioned scores with provenance for every agent dimension', async () => {
    const fixture = structuredClone(AGENT_EVALUATOR_FIXTURE_SUITE.fixtures[0]);
    const results = await Promise.all(createDefaultAgentEvaluators().map((evaluator) => evaluator.evaluate(fixture, 'run-1')));
    expect(results.map((result) => result.kind)).toEqual(['task', 'tool_selection', 'code_change', 'policy', 'trajectory', 'retrieval']);
    for (const result of results) {
      expect(result.score).toBe(1);
      expect(result.provenance).toMatchObject({ runId: 'run-1', fixtureId: fixture.id, fixtureVersion: fixture.version });
      expect(result.provenance.evaluatorVersion).toMatch(/^\d+\.\d+\.\d+$/);
    }
    expect(results.find((result) => result.kind === 'retrieval')).toMatchObject({ recallAtK: 1, reciprocalRank: 1, ndcgAtK: 1 });
  });
});
