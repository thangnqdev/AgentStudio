import { describe, expect, it } from 'vitest';
import { aggregateKnowledgeMetrics, scoreKnowledgeRetrieval } from './knowledgeEvaluationMetrics.js';

describe('knowledge evaluation metrics', () => {
  it('scores recall, precision, reciprocal rank and nDCG', () => {
    const result = scoreKnowledgeRetrieval(['a', 'b'], ['x', 'a', 'b']);
    expect(result.recallAtK).toBe(1);
    expect(result.precisionAtK).toBeCloseTo(2 / 3);
    expect(result.reciprocalRank).toBe(0.5);
    expect(result.ndcgAtK).toBeGreaterThan(0.6);
    expect(result.ndcgAtK).toBeLessThan(1);
  });

  it('aggregates latency percentiles deterministically', () => {
    const cases = [1, 2, 3, 100].map((latencyMs, index) => ({
      caseId: String(index), query: '', retrievedChunkIds: [], missingChunkIds: [], latencyMs,
      recallAtK: 1, precisionAtK: 1, reciprocalRank: 1, ndcgAtK: 1,
    }));
    const metrics = aggregateKnowledgeMetrics(cases);
    expect(metrics.latencyMs.p50).toBe(2);
    expect(metrics.latencyMs.p95).toBe(100);
    expect(metrics.recallAtK).toBe(1);
  });

  it('treats an empty expected and observed retrieval as a correct no-op', () => {
    expect(scoreKnowledgeRetrieval([], [])).toEqual({
      recallAtK: 1,
      precisionAtK: 1,
      reciprocalRank: 1,
      ndcgAtK: 1,
    });
  });
});
