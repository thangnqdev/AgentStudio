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
