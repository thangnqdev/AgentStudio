import type { KnowledgeChunk, KnowledgeDocument, KnowledgeSearchResult } from '../../domain/entities/knowledge.js';
import { foldKnowledgeText, tokenizeKnowledgeText } from './knowledgeText.js';

type Candidate = {
  chunk: KnowledgeChunk;
  document: KnowledgeDocument;
  lexicalScore: number;
  semanticScore: number;
  phraseScore: number;
  fusionScore: number;
};

export function retrieveKnowledge(
  chunks: KnowledgeChunk[],
  documents: KnowledgeDocument[],
  query: string,
  queryEmbedding: number[] | null,
  embeddingProfile: string | undefined,
  limit: number,
  weights: { lexicalWeight: number; semanticWeight: number } = { lexicalWeight: 0.5, semanticWeight: 0.5 },
) {
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const queryTerms = tokenizeKnowledgeText(query);
  const lexicalScores = getBm25Scores(chunks, queryTerms);
  const semanticAvailable = Boolean(queryEmbedding && embeddingProfile && documents.some((document) => document.embeddingProfile === embeddingProfile));
  const candidates = chunks.map((chunk, index): Candidate | null => {
    const document = documentsById.get(chunk.documentId);
    if (!document) return null;
    const lexicalScore = lexicalScores[index] ?? 0;
    const semanticScore = semanticAvailable && document.embeddingProfile === embeddingProfile && queryEmbedding && chunk.embedding
      ? Math.max(0, cosineSimilarity(queryEmbedding, chunk.embedding))
      : 0;
    return { chunk, document, lexicalScore, semanticScore, phraseScore: phraseScore(query, chunk.content, chunk.section), fusionScore: 0 };
  }).filter((candidate): candidate is Candidate => candidate !== null);

  const lexicalRanks = rankMap(candidates, (candidate) => candidate.lexicalScore + candidate.phraseScore);
  const semanticRanks = rankMap(candidates, (candidate) => candidate.semanticScore);
  for (const candidate of candidates) {
    const lexicalRank = lexicalRanks.get(candidate.chunk.id);
    const semanticRank = semanticRanks.get(candidate.chunk.id);
    candidate.fusionScore = (lexicalRank ? 2 * weights.lexicalWeight / (60 + lexicalRank) : 0)
      + (semanticAvailable && semanticRank ? 2 * weights.semanticWeight / (60 + semanticRank) : 0)
      + candidate.phraseScore * 0.015;
  }

  const ranked = candidates
    .filter((candidate) => candidate.lexicalScore > 0 || candidate.semanticScore >= 0.22 || candidate.phraseScore > 0)
    .sort((left, right) => right.fusionScore - left.fusionScore)
    .slice(0, Math.max(limit * 5, 16));
  return {
    mode: semanticAvailable ? 'hybrid' as const : 'lexical' as const,
    results: diversify(ranked, limit).map(toSearchResult),
  };
}

function getBm25Scores(chunks: KnowledgeChunk[], queryTerms: string[]) {
  const chunkTerms = chunks.map((chunk) => tokenizeKnowledgeText(chunk.content));
  const averageLength = chunkTerms.reduce((sum, terms) => sum + terms.length, 0) / Math.max(chunks.length, 1);
  const documentFrequency = new Map<string, number>();
  for (const terms of chunkTerms) for (const term of new Set(terms)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  const uniqueQueryTerms = [...new Set(queryTerms)];
  return chunkTerms.map((terms) => {
    const counts = new Map<string, number>();
    for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
    return uniqueQueryTerms.reduce((score, term) => {
      const frequency = counts.get(term) ?? 0;
      if (!frequency) return score;
      const df = documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (chunks.length - df + 0.5) / (df + 0.5));
      return score + idf * (frequency * 2.2) / (frequency + 1.2 * (1 - 0.75 + 0.75 * (terms.length / Math.max(averageLength, 1))));
    }, 0);
  });
}

function rankMap(candidates: Candidate[], selector: (candidate: Candidate) => number) {
  return new Map(candidates.filter((candidate) => selector(candidate) > 0)
    .sort((left, right) => selector(right) - selector(left))
    .map((candidate, index) => [candidate.chunk.id, index + 1]));
}

function diversify(candidates: Candidate[], limit: number) {
  const selected: Candidate[] = [];
  const remaining = [...candidates];
  while (remaining.length > 0 && selected.length < limit) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let index = 0; index < remaining.length; index += 1) {
      const redundancy = selected.length === 0 ? 0 : Math.max(...selected.map((item) => chunkSimilarity(remaining[index].chunk, item.chunk)));
      const score = 0.78 * remaining[index].fusionScore - 0.22 * redundancy;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    selected.push(remaining.splice(bestIndex, 1)[0]);
  }
  return selected;
}

function chunkSimilarity(left: KnowledgeChunk, right: KnowledgeChunk) {
  if (left.embedding && right.embedding) return Math.max(0, cosineSimilarity(left.embedding, right.embedding));
  const leftTerms = new Set(tokenizeKnowledgeText(left.content));
  const rightTerms = new Set(tokenizeKnowledgeText(right.content));
  let intersection = 0;
  for (const term of leftTerms) if (rightTerms.has(term)) intersection += 1;
  return intersection / Math.max(leftTerms.size + rightTerms.size - intersection, 1);
}

function phraseScore(query: string, content: string, section: string) {
  const normalizedQuery = foldKnowledgeText(query);
  const exactPhrase = normalizedQuery.length > 4 && foldKnowledgeText(content).includes(normalizedQuery) ? 1 : 0;
  const headingMatch = tokenizeKnowledgeText(query).some((term) => term.length > 2 && foldKnowledgeText(section).includes(term)) ? 0.5 : 0;
  return exactPhrase + headingMatch;
}

function toSearchResult(candidate: Candidate): KnowledgeSearchResult {
  const citation = `[KB: ${candidate.document.name} | ${candidate.chunk.section}]`;
  const content = candidate.chunk.content.replace(/^\[Source:[^\n]+\]\n?/, '').trim();
  return {
    chunkId: candidate.chunk.id,
    documentId: candidate.document.id,
    sourceName: candidate.document.name,
    section: candidate.chunk.section,
    content,
    excerpt: content.length > 280 ? `${content.slice(0, 280).trimEnd()}...` : content,
    citation,
    score: Math.round(candidate.fusionScore * 10_000) / 10_000,
    lexicalScore: Math.round(candidate.lexicalScore * 1_000) / 1_000,
    semanticScore: Math.round(candidate.semanticScore * 1_000) / 1_000,
  };
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || left.length === 0) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  return dot / Math.max(Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude), Number.EPSILON);
}
