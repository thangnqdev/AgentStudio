import { describe, expect, it } from 'vitest';
import { createEmbeddingProfile, isCurrentKnowledgeDocument } from './knowledgeIndexing.js';

describe('knowledge indexing metadata', () => {
  it('requires a matching embedding profile before reusing an index', () => {
    const profile = createEmbeddingProfile({ baseUrl: 'https://api.example.com/v1/', apiKey: 'secret', model: 'text-embedding-3-small' });
    const document = { contentHash: 'hash', indexVersion: 2, embeddingProfile: profile };

    expect(profile).toBe('https://api.example.com/v1|text-embedding-3-small');
    expect(isCurrentKnowledgeDocument(document, 'hash', 2, profile)).toBe(true);
    expect(isCurrentKnowledgeDocument(document, 'hash', 2, 'https://api.example.com/v1|another-model')).toBe(false);
  });
});
