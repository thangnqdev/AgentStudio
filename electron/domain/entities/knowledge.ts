export type KnowledgeDocument = {
  id: string;
  name: string;
  sourcePath: string;
  contentHash: string;
  addedAt: string;
  updatedAt: string;
  size: number;
  chunkCount: number;
  indexingMode: 'hybrid' | 'lexical';
};

export type KnowledgeChunk = {
  id: string;
  documentId: string;
  ordinal: number;
  content: string;
  section: string;
  tokenCount: number;
  embedding?: number[];
};

export type KnowledgeStore = {
  version: 1;
  documents: KnowledgeDocument[];
  chunks: KnowledgeChunk[];
};

export type KnowledgeSourceDocument = {
  name: string;
  sourcePath: string;
  content: string;
  size: number;
  contentHash: string;
};

export type KnowledgeEmbeddingConfig = {
  baseUrl: string;
  apiKey: string;
};

export type KnowledgeSearchResult = {
  chunkId: string;
  documentId: string;
  sourceName: string;
  section: string;
  content: string;
  excerpt: string;
  citation: string;
  score: number;
  lexicalScore: number;
  semanticScore: number;
};

export type KnowledgeSearchResponse = {
  query: string;
  mode: 'hybrid' | 'lexical';
  results: KnowledgeSearchResult[];
};
