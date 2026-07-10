export const CURRENT_KNOWLEDGE_INDEX_VERSION = 2;
export const CURRENT_KNOWLEDGE_STORE_VERSION = 2;

export type KnowledgeSourceKind = 'text' | 'code' | 'database';

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
  indexVersion: number;
  sourceKind: KnowledgeSourceKind;
  language?: string;
  embeddingProfile?: string;
};

export type KnowledgeChunk = {
  id: string;
  documentId: string;
  ordinal: number;
  content: string;
  section: string;
  tokenCount: number;
  sourceKind: KnowledgeSourceKind;
  language?: string;
  symbol?: string;
  embedding?: number[];
};

export type KnowledgeStore = {
  version: number;
  documents: KnowledgeDocument[];
  chunks: KnowledgeChunk[];
};

export type KnowledgeSourceDocument = {
  name: string;
  sourcePath: string;
  content: string;
  size: number;
  contentHash: string;
  extension: string;
  sourceKind: KnowledgeSourceKind;
  language?: string;
};

export type KnowledgeEmbeddingConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
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
