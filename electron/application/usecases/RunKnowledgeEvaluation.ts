import type { KnowledgeEvalDataset, KnowledgeEvalReport, KnowledgeEvalStrategyResult } from '../../domain/entities/knowledgeEvaluation.js';
import type { IKnowledgeRetriever } from '../../domain/ports/IKnowledgeRetriever.js';
import { aggregateKnowledgeMetrics, scoreKnowledgeRetrieval } from '../services/knowledgeEvaluationMetrics.js';

export class RunKnowledgeEvaluation {
  private readonly retrievers: IKnowledgeRetriever[];

  constructor(retrievers: IKnowledgeRetriever[]) {
    this.retrievers = retrievers;
  }

  async execute(dataset: KnowledgeEvalDataset, limit = 5): Promise<KnowledgeEvalReport> {
    if (!dataset.cases.length) throw new Error('Evaluation dataset has no cases.');
    if (!this.retrievers.length) throw new Error('At least one retrieval strategy is required.');
    const results: KnowledgeEvalStrategyResult[] = [];
    for (const retriever of this.retrievers) {
      const caseResults = [];
      for (const evalCase of dataset.cases) {
        const startedAt = performance.now();
        const response = await retriever.search(evalCase, limit);
        const latencyMs = performance.now() - startedAt;
        const retrievedChunkIds = response.results.map((result) => result.chunkId);
        const scores = scoreKnowledgeRetrieval(evalCase.relevantChunkIds, retrievedChunkIds);
        caseResults.push({
          caseId: evalCase.id,
          query: evalCase.query,
          retrievedChunkIds,
          missingChunkIds: evalCase.relevantChunkIds.filter((id) => !retrievedChunkIds.includes(id)),
          latencyMs,
          ...scores,
        });
      }
      results.push({ strategyId: retriever.id, limit, metrics: aggregateKnowledgeMetrics(caseResults), cases: caseResults });
    }
    return { datasetName: dataset.name, createdAt: new Date().toISOString(), results };
  }
}
