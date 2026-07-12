import type { KnowledgeChunk, KnowledgeDocument } from './knowledge.js';

export type KnowledgeEvalCase = {
  id: string;
  query: string;
  relevantChunkIds: string[];
  tags?: string[];
  queryEmbedding?: number[];
  embeddingProfile?: string;
};

export type KnowledgeEvalDataset = {
  name: string;
  documents: KnowledgeDocument[];
  chunks: KnowledgeChunk[];
  cases: KnowledgeEvalCase[];
};

export type KnowledgeEvalMetrics = {
  caseCount: number;
  recallAtK: number;
  precisionAtK: number;
  meanReciprocalRank: number;
  ndcgAtK: number;
  latencyMs: { mean: number; p50: number; p95: number; p99: number };
};

export type KnowledgeEvalCaseResult = {
  caseId: string;
  query: string;
  retrievedChunkIds: string[];
  missingChunkIds: string[];
  latencyMs: number;
  recallAtK: number;
  precisionAtK: number;
  reciprocalRank: number;
  ndcgAtK: number;
};

export type KnowledgeEvalStrategyResult = {
  strategyId: string;
  limit: number;
  metrics: KnowledgeEvalMetrics;
  cases: KnowledgeEvalCaseResult[];
};

export type KnowledgeEvalReport = {
  datasetName: string;
  createdAt: string;
  results: KnowledgeEvalStrategyResult[];
};
