import type { KnowledgeSourceDocument } from '../entities/knowledge.js';

export interface IKnowledgeSourceReader {
  read(sourcePath: string): Promise<KnowledgeSourceDocument>;
}
