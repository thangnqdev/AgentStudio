import type { KnowledgeChunk } from '../../domain/entities/knowledge.js';
import type { KnowledgeEvalCase } from '../../domain/entities/knowledgeEvaluation.js';

export function generateKnowledgeEvalCandidates(chunks: KnowledgeChunk[], maximumCases = 200): KnowledgeEvalCase[] {
  const usedQueries = new Set<string>();
  const candidates: KnowledgeEvalCase[] = [];
  for (const chunk of chunks) {
    const subject = chunk.symbol?.trim() || normalizeSection(chunk.section);
    if (!subject || subject.length < 3) continue;
    const query = chunk.symbol ? `Where is ${subject} implemented?` : `What does ${subject} describe?`;
    const normalizedQuery = query.toLocaleLowerCase();
    if (usedQueries.has(normalizedQuery)) continue;
    usedQueries.add(normalizedQuery);
    candidates.push({
      id: `generated-${chunk.id}`,
      query,
      relevantChunkIds: [chunk.id],
      tags: ['generated', chunk.symbol ? 'symbol' : 'section'],
    });
    if (candidates.length >= maximumCases) break;
  }
  return candidates;
}

function normalizeSection(section: string) {
  return section.replace(/^(section|symbol):\s*/i, '').trim();
}
