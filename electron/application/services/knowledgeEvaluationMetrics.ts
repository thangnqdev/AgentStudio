import type { KnowledgeEvalCaseResult, KnowledgeEvalMetrics } from '../../domain/entities/knowledgeEvaluation.js';

export function scoreKnowledgeRetrieval(relevantChunkIds: string[], retrievedChunkIds: string[]) {
  const relevant = new Set(relevantChunkIds);
  const hits = retrievedChunkIds.filter((id) => relevant.has(id));
  const firstRelevantRank = retrievedChunkIds.findIndex((id) => relevant.has(id));
  const idealHits = Math.min(relevant.size, retrievedChunkIds.length);
  const dcg = retrievedChunkIds.reduce((score, id, index) => score + (relevant.has(id) ? 1 / Math.log2(index + 2) : 0), 0);
  let idealDcg = 0;
  for (let index = 0; index < idealHits; index += 1) idealDcg += 1 / Math.log2(index + 2);
  return {
    recallAtK: relevant.size ? hits.length / relevant.size : 1,
    precisionAtK: retrievedChunkIds.length ? hits.length / retrievedChunkIds.length : relevant.size ? 0 : 1,
    reciprocalRank: relevant.size === 0
      ? (retrievedChunkIds.length === 0 ? 1 : 0)
      : firstRelevantRank < 0 ? 0 : 1 / (firstRelevantRank + 1),
    ndcgAtK: idealDcg ? dcg / idealDcg : 1,
  };
}

export function aggregateKnowledgeMetrics(cases: KnowledgeEvalCaseResult[]): KnowledgeEvalMetrics {
  const latencies = cases.map((item) => item.latencyMs).sort((left, right) => left - right);
  const mean = (selector: (item: KnowledgeEvalCaseResult) => number) =>
    cases.reduce((total, item) => total + selector(item), 0) / Math.max(cases.length, 1);
  return {
    caseCount: cases.length,
    recallAtK: mean((item) => item.recallAtK),
    precisionAtK: mean((item) => item.precisionAtK),
    meanReciprocalRank: mean((item) => item.reciprocalRank),
    ndcgAtK: mean((item) => item.ndcgAtK),
    latencyMs: {
      mean: mean((item) => item.latencyMs),
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
    },
  };
}

function percentile(sortedValues: number[], percentileValue: number) {
  if (!sortedValues.length) return 0;
  return sortedValues[Math.min(Math.ceil(sortedValues.length * percentileValue) - 1, sortedValues.length - 1)];
}
