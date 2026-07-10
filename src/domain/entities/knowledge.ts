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
