import type { KnowledgeEmbeddingConfig } from '../entities/knowledge.js';

export interface IKnowledgeConfigProvider {
  getEmbeddingConfig(): Promise<KnowledgeEmbeddingConfig | undefined>;
}
