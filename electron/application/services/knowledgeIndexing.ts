import type { KnowledgeEmbeddingConfig } from '../../domain/entities/knowledge.js';

export function createEmbeddingProfile(config: KnowledgeEmbeddingConfig) {
  return `${config.baseUrl.replace(/\/$/, '').toLowerCase()}|${config.model}`;
}

export function isCurrentKnowledgeDocument(
  document: { contentHash: string; indexVersion?: number; embeddingProfile?: string },
  contentHash: string,
  indexVersion: number,
  embeddingProfile: string | undefined,
) {
  return document.contentHash === contentHash
    && document.indexVersion === indexVersion
    && (!embeddingProfile || document.embeddingProfile === embeddingProfile);
}
