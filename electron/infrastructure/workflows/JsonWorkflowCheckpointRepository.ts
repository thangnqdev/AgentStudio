import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertNodeCheckpoint, type NodeCheckpoint } from '../../domain/entities/workflow.js';
import type { IWorkflowCheckpointRepository } from '../../domain/ports/IWorkflowCheckpointRepository.js';

export class JsonWorkflowCheckpointRepository implements IWorkflowCheckpointRepository {
  private queue = Promise.resolve();
  private readonly configuredPath?: string;
  constructor(configuredPath?: string) { this.configuredPath = configuredPath; }
  async save(checkpoint: NodeCheckpoint) {
    assertNodeCheckpoint(checkpoint);
    const operation = this.queue.then(async () => {
      const current = await this.read(); const next = [checkpoint, ...current.filter((item) => item.runId !== checkpoint.runId)].slice(0, 100);
      await fs.mkdir(path.dirname(this.getPath()), { recursive: true });
      const temporary = `${this.getPath()}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, JSON.stringify({ checkpoints: next }), { encoding: 'utf8', mode: 0o600 });
      await fs.rename(temporary, this.getPath());
    });
    this.queue = operation.catch(() => undefined); await operation;
  }
  async get(runId: string) { await this.queue; return (await this.read()).find((item) => item.runId === runId) ?? null; }
  async list(limit = 50) { await this.queue; return (await this.read()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, Math.min(Math.max(limit, 1), 100)); }
  private async read(): Promise<NodeCheckpoint[]> { try { const value = JSON.parse(await fs.readFile(this.getPath(), 'utf8')) as { checkpoints?: unknown }; return Array.isArray(value.checkpoints) ? value.checkpoints.flatMap((item): NodeCheckpoint[] => { try { assertNodeCheckpoint(item as NodeCheckpoint); return [item as NodeCheckpoint]; } catch { return []; } }) : []; } catch { return []; } }
  private getPath() { return this.configuredPath ?? path.join(app.getPath('userData'), 'workflows', 'checkpoints.json'); }
}
