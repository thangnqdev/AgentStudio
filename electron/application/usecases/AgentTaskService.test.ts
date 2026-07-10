import { describe, expect, it } from 'vitest';
import { AgentTaskService } from './AgentTaskService.js';
import type { IAgentTaskRepository } from '../../domain/ports/IAgentTaskRepository.js';
import type { AgentTaskCheckpoint, AgentTaskRecord, AgentTaskSummary } from '../../domain/entities/agentTask.js';

describe('AgentTaskService', () => {
  it('creates a durable task from valid chat messages', async () => {
    const repository = new MemoryTaskRepository();
    const service = new AgentTaskService(repository);

    const task = await service.create({
      messages: [
        { id: 'ignored', sender: 'other' as never, content: 'ignore' },
        { id: 'user-1', sender: 'user', content: 'Refactor the import pipeline.' },
      ],
    }, '/workspace', 'knowledge');

    expect(task.workspaceRoot).toBe('/workspace');
    expect(task.title).toBe('Refactor the import pipeline.');
    expect(task.messages).toHaveLength(1);
    expect(repository.tasks).toHaveLength(1);
  });

  it('rejects resume when the task step budget is exhausted', async () => {
    const repository = new MemoryTaskRepository([task({ completedSteps: 180, status: 'paused' })]);
    const service = new AgentTaskService(repository);

    await expect(service.resume('task-1', '/workspace')).rejects.toThrow('180 bước');
  });
});

class MemoryTaskRepository implements IAgentTaskRepository {
  tasks: AgentTaskRecord[];

  constructor(tasks: AgentTaskRecord[] = []) {
    this.tasks = tasks;
  }

  async create(record: AgentTaskRecord) { this.tasks = [record, ...this.tasks]; }
  async get(taskId: string) { return this.tasks.find((record) => record.id === taskId) ?? null; }
  async listResumable(_workspaceRoot: string): Promise<AgentTaskSummary[]> { return []; }
  async saveCheckpoint(checkpoint: AgentTaskCheckpoint) {
    this.tasks = this.tasks.map((record) => record.id === checkpoint.id ? { ...record, ...checkpoint } : record);
  }
  async recoverInterrupted() {}
  async markPaused() {}
  async markFailed() {}
}

function task(overrides: Partial<AgentTaskRecord> = {}): AgentTaskRecord {
  return {
    id: 'task-1',
    title: 'Task',
    workspaceRoot: '/workspace',
    status: 'paused',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    completedSteps: 0,
    messages: [],
    conversation: [],
    ...overrides,
  };
}
