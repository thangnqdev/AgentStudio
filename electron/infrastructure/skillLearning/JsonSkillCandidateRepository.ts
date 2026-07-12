import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { assertSkillCandidate, type SkillCandidate } from '../../domain/entities/skillLearning.js';
import type { ISkillCandidateRepository } from '../../domain/ports/ISkillCandidateRepository.js';

export class JsonSkillCandidateRepository implements ISkillCandidateRepository {
  private readonly configuredPath?: string; private queue = Promise.resolve();
  constructor(configuredPath?: string) { this.configuredPath = configuredPath; }
  async list() { await this.queue; try { const values = JSON.parse(await fs.readFile(this.getPath(), 'utf8')) as SkillCandidate[]; if (!Array.isArray(values)) throw new Error('Candidate store must be an array.'); values.forEach(assertSkillCandidate); return values.sort((left, right) => right.createdAt.localeCompare(left.createdAt)); } catch (error) { if (missing(error)) return []; throw new Error('Persisted skill candidate store is invalid.', { cause: error }); } }
  save(candidate: SkillCandidate) {
    assertSkillCandidate(candidate);
    const operation = this.queue.then(async () => { const values = await this.readUnlocked(); const next = [candidate, ...values.filter((item) => item.id !== candidate.id)].slice(0, 100); const target = this.getPath(); const temporary = `${target}.tmp`; await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 }); await fs.rename(temporary, target); await fs.chmod(target, 0o600).catch(() => undefined); });
    this.queue = operation.catch(() => undefined); return operation;
  }
  private async readUnlocked() { try { const values = JSON.parse(await fs.readFile(this.getPath(), 'utf8')) as SkillCandidate[]; if (!Array.isArray(values)) throw new Error('Candidate store must be an array.'); values.forEach(assertSkillCandidate); return values; } catch (error) { if (missing(error)) return []; throw error; } }
  private getPath() { return this.configuredPath ?? path.join(app.getPath('userData'), 'skill-learning', 'candidates.json'); }
}
function missing(error: unknown): error is NodeJS.ErrnoException { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
