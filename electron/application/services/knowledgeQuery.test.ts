import { describe, expect, it } from 'vitest';
import { buildKnowledgeQuery } from './knowledgeQuery.js';

describe('buildKnowledgeQuery', () => {
  it('keeps the latest question while adding recent user context', () => {
    const query = buildKnowledgeQuery('What about its foreign keys?', ['Tell me about the bookings table.', 'Which columns matter?']);

    expect(query).toContain('Which columns matter?');
    expect(query).toContain('What about its foreign keys?');
  });
});
