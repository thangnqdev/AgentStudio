import { describe, expect, it } from 'vitest';
import type { KnowledgeChunk, KnowledgeDocument } from '../../domain/entities/knowledge.js';
import { retrieveKnowledge } from './knowledgeRetrieval.js';

const document: KnowledgeDocument = {
  id: 'document-1', name: 'bookings.md', sourcePath: '/workspace/bookings.md', contentHash: 'hash',
  addedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', size: 100, chunkCount: 1,
  indexingMode: 'hybrid', indexVersion: 2, sourceKind: 'text', embeddingProfile: 'profile-a',
};

const chunk: KnowledgeChunk = {
  id: 'chunk-1', documentId: document.id, ordinal: 1, section: 'Bookings', tokenCount: 6,
  content: 'Bookings are linked to customers through customer_id.', sourceKind: 'text', embedding: [1, 0],
};

describe('retrieveKnowledge', () => {
  it('does not use vectors indexed with a different embedding profile', () => {
    const retrieval = retrieveKnowledge([chunk], [document], 'bookings customer', [1, 0], 'profile-b', 5);

    expect(retrieval.mode).toBe('lexical');
    expect(retrieval.results[0]?.semanticScore).toBe(0);
  });

  it('applies reversible lexical and semantic ranking weights', () => {
    const semanticChunk: KnowledgeChunk = { ...chunk, id: 'semantic', content: 'unrelated material', embedding: [1, 0] };
    const lexicalChunk: KnowledgeChunk = { ...chunk, id: 'lexical', content: 'bookings customer relationship', embedding: [0, 1] };
    const lexical = retrieveKnowledge([semanticChunk, lexicalChunk], [document], 'bookings customer', [1, 0], 'profile-a', 2, { lexicalWeight: 1, semanticWeight: 0 });
    const semantic = retrieveKnowledge([semanticChunk, lexicalChunk], [document], 'bookings customer', [1, 0], 'profile-a', 2, { lexicalWeight: 0, semanticWeight: 1 });
    expect(lexical.results[0]?.chunkId).toBe('lexical');
    expect(semantic.results[0]?.chunkId).toBe('semantic');
  });
});
