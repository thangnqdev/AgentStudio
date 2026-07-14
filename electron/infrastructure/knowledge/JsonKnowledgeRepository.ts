import { app } from 'electron';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CURRENT_KNOWLEDGE_STORE_VERSION, type KnowledgeStore } from '../../domain/entities/knowledge.js';
import type { IKnowledgeRepository } from '../../domain/ports/IKnowledgeRepository.js';
import { writePrivateFileAtomic } from '../storage/privateFile.js';

const EMPTY_STORE: KnowledgeStore = { version: CURRENT_KNOWLEDGE_STORE_VERSION, documents: [], chunks: [] };

export class JsonKnowledgeRepository implements IKnowledgeRepository {
  async load(workspacePath: string): Promise<KnowledgeStore> {
    try {
      const raw = await fs.readFile(this.getStorePath(workspacePath), 'utf8');
      const parsed = JSON.parse(raw) as Partial<KnowledgeStore>;
      return {
        version: CURRENT_KNOWLEDGE_STORE_VERSION,
        documents: Array.isArray(parsed.documents) ? parsed.documents : [],
        chunks: Array.isArray(parsed.chunks) ? parsed.chunks : [],
      };
    } catch {
      return { ...EMPTY_STORE, documents: [], chunks: [] };
    }
  }

  async save(workspacePath: string, store: KnowledgeStore) {
    const targetPath = this.getStorePath(workspacePath);
    await writePrivateFileAtomic(targetPath, JSON.stringify(store));
  }

  private getStorePath(workspacePath: string) {
    const hash = createHash('sha256').update(path.resolve(workspacePath || process.cwd())).digest('hex').slice(0, 24);
    return path.join(app.getPath('userData'), 'knowledge-base', `${hash}.json`);
  }
}
