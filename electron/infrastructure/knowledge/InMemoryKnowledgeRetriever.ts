import type { KnowledgeStore } from '../../domain/entities/knowledge.js';
import type { KnowledgeEvalCase } from '../../domain/entities/knowledgeEvaluation.js';
import type { IKnowledgeRetriever } from '../../domain/ports/IKnowledgeRetriever.js';
import { retrieveKnowledge } from '../../application/services/knowledgeRetrieval.js';

export class InMemoryKnowledgeRetriever implements IKnowledgeRetriever {
  readonly id = 'current-hybrid-rrf';
  private readonly store: KnowledgeStore;

  constructor(store: KnowledgeStore) {
    this.store = store;
  }

  async search(evalCase: KnowledgeEvalCase, limit: number) {
    const retrieval = retrieveKnowledge(
      this.store.chunks,
      this.store.documents,
      evalCase.query,
      evalCase.queryEmbedding ?? null,
      evalCase.embeddingProfile,
      limit,
    );
    return { query: evalCase.query, ...retrieval };
  }
}
