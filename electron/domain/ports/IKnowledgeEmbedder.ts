import type { KnowledgeEmbeddingConfig } from '../entities/knowledge.js';

export interface IKnowledgeEmbedder {
  embed(input: string[], config: KnowledgeEmbeddingConfig): Promise<number[][]>;
}
