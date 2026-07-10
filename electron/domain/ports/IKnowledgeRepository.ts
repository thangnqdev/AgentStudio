import type { KnowledgeStore } from '../entities/knowledge.js';

export interface IKnowledgeRepository {
  load(workspacePath: string): Promise<KnowledgeStore>;
  save(workspacePath: string, store: KnowledgeStore): Promise<void>;
}
