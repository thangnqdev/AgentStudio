import type { KnowledgeEvalCase } from '../entities/knowledgeEvaluation.js';
import type { KnowledgeSearchResponse } from '../entities/knowledge.js';

export interface IKnowledgeRetriever {
  readonly id: string;
  search(evalCase: KnowledgeEvalCase, limit: number): Promise<KnowledgeSearchResponse>;
}
