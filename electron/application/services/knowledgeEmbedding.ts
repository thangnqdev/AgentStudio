import type { KnowledgeChunk, KnowledgeEmbeddingConfig } from '../../domain/entities/knowledge.js';
import type { IKnowledgeEmbedder } from '../../domain/ports/IKnowledgeEmbedder.js';
import { createEmbeddingProfile } from './knowledgeIndexing.js';

const QUERY_CACHE_LIMIT = 48;

export class KnowledgeEmbeddingService {
  private readonly queryEmbeddingCache = new Map<string, number[]>();
  private readonly embedder: IKnowledgeEmbedder;

  constructor(embedder: IKnowledgeEmbedder) {
    this.embedder = embedder;
  }

  async attach(chunks: KnowledgeChunk[], config: KnowledgeEmbeddingConfig | undefined) {
    if (!config || chunks.length === 0) return 'lexical' as const;
    try {
      for (let start = 0; start < chunks.length; start += 64) {
        const batch = chunks.slice(start, start + 64);
        const embeddings = await this.embedder.embed(batch.map((chunk) => chunk.content), config);
        batch.forEach((chunk, index) => { chunk.embedding = embeddings[index]; });
      }
      return 'hybrid' as const;
    } catch {
      return 'lexical' as const;
    }
  }

  async embedQuery(query: string, config: KnowledgeEmbeddingConfig) {
    const key = `${createEmbeddingProfile(config)}|${query}`;
    const cached = this.queryEmbeddingCache.get(key);
    if (cached) return cached;
    try {
      const [embedding] = await this.embedder.embed([query], config);
      if (!embedding) return null;
      this.queryEmbeddingCache.set(key, embedding);
      if (this.queryEmbeddingCache.size > QUERY_CACHE_LIMIT) this.queryEmbeddingCache.delete(this.queryEmbeddingCache.keys().next().value as string);
      return embedding;
    } catch {
      return null;
    }
  }
}
