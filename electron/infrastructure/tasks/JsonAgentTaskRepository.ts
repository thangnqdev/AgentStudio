import { app } from 'electron';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentTaskCheckpoint, AgentTaskRecord, AgentTaskSummary } from '../../domain/entities/agentTask.js';
import { summarizeAgentTask } from '../../domain/entities/agentTask.js';
import type { IAgentTaskRepository } from '../../domain/ports/IAgentTaskRepository.js';
import { writePrivateFileAtomic } from '../storage/privateFile.js';

type StoredTasks = { tasks: AgentTaskRecord[] };

/** Local durable store for agent execution state. API keys are never stored here. */
export class JsonAgentTaskRepository implements IAgentTaskRepository {
  private queue = Promise.resolve();

  async create(task: AgentTaskRecord) {
    await this.mutate((tasks) => [task, ...tasks.filter((item) => item.id !== task.id)]);
  }

  async get(taskId: string) {
    const tasks = await this.read();
    return tasks.find((task) => task.id === taskId) ?? null;
  }

  async listResumable(workspaceRoot: string): Promise<AgentTaskSummary[]> {
    const tasks = await this.read();
    return tasks
      .filter((task) => task.workspaceRoot === workspaceRoot && (task.status === 'paused' || task.status === 'failed'))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 12)
      .map(summarizeAgentTask);
  }

  async saveCheckpoint(checkpoint: AgentTaskCheckpoint) {
    await this.mutate((tasks) => tasks.map((task) => task.id === checkpoint.id
      ? { ...task, ...checkpoint, updatedAt: new Date().toISOString() }
      : task));
  }

  async recoverInterrupted() {
    const interrupted = (await this.read()).filter((task) => task.status === 'running');
    await this.mutate((tasks) => tasks.map((task) => task.status === 'running'
      ? { ...task, status: 'paused', lastError: 'Ứng dụng đã đóng trước khi tác vụ hoàn tất.', updatedAt: new Date().toISOString() }
      : task));
    return interrupted.map((task) => ({ ...task, status: 'paused' as const, lastError: 'Ứng dụng đã đóng trước khi tác vụ hoàn tất.' }));
  }

  async markFailed(taskId: string, error: string) {
    await this.mutate((tasks) => tasks.map((task) => task.id === taskId
      ? { ...task, status: 'failed', lastError: error.slice(0, 1_000), updatedAt: new Date().toISOString() }
      : task));
  }

  async markPaused(taskId: string, reason?: string) {
    await this.mutate((tasks) => tasks.map((task) => task.id === taskId
      ? { ...task, status: 'paused', lastError: reason, updatedAt: new Date().toISOString() }
      : task));
  }

  private getPath() {
    return path.join(app.getPath('userData'), 'agent-tasks.json');
  }

  private async read() {
    try {
      const raw = await fs.readFile(this.getPath(), 'utf8');
      const parsed = JSON.parse(raw) as StoredTasks;
      return Array.isArray(parsed.tasks) ? parsed.tasks.map((task) => ({
        ...task,
        traceId: typeof task.traceId === 'string' && task.traceId ? task.traceId : createHash('sha256').update(`legacy-task:${task.id}`).digest('hex').slice(0, 32),
      })) : [];
    } catch {
      return [];
    }
  }

  private async mutate(mutation: (tasks: AgentTaskRecord[]) => AgentTaskRecord[]) {
    const operation = this.queue.then(async () => {
      const tasks = mutation(await this.read()).slice(0, 100);
      await writePrivateFileAtomic(this.getPath(), JSON.stringify({ tasks }));
    });
    this.queue = operation.catch(() => undefined);
    await operation;
  }
}
