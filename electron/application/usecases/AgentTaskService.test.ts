import { describe, expect, it } from 'vitest';
import { AgentTaskService } from './AgentTaskService.js';
import type { IAgentTaskRepository } from '../../domain/ports/IAgentTaskRepository.js';
import type { AgentTaskCheckpoint, AgentTaskRecord, AgentTaskSummary } from '../../domain/entities/agentTask.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';

describe('AgentTaskService', () => {
  it('creates a durable task from valid chat messages', async () => {
    const repository = new MemoryTaskRepository();
    const service = new AgentTaskService(repository, new MemoryTracer());

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
    expect(task.traceId).toBeTruthy();
  });

  it('keeps attachment capabilities only in the live run, never in durable checkpoints', async () => {
    const repository = new MemoryTaskRepository();
    const service = new AgentTaskService(repository, new MemoryTracer());
    const task = await service.create({ messages: [{
      id: 'user-1', sender: 'user', content: 'Review', attachments: [{
        id: 'attachment-1', name: 'note.txt', type: 'text',
        filePath: '/private/note.txt', authorizationToken: 'opaque-token',
      }],
    }] }, '/workspace', '');

    expect(task.messages[0].attachments?.[0]).toHaveProperty('filePath', '/private/note.txt');
    expect(repository.tasks[0].messages[0].attachments?.[0]).not.toHaveProperty('filePath');
    await service.checkpoint({ ...task, status: 'paused' });
    expect(repository.tasks[0].messages[0].attachments?.[0]).not.toHaveProperty('authorizationToken');
  });

  it('rejects resume when the task step budget is exhausted', async () => {
    const repository = new MemoryTaskRepository([task({ completedSteps: 180, status: 'paused' })]);
    const service = new AgentTaskService(repository, new MemoryTracer());

    await expect(service.resume('task-1', '/workspace')).rejects.toThrow('180 bước');
  });

  it('forks an independent paused branch with fresh budgets and lineage', async () => {
    const source = task({ completedSteps: 42, messages: [{ id: 'user', sender: 'user', content: 'source' }] });
    const repository = new MemoryTaskRepository([source]);
    const tracer = new MemoryTracer();
    const service = new AgentTaskService(repository, tracer);

    const summary = await service.fork(source.id, source.workspaceRoot);
    const branch = await repository.get(summary.id);
    expect(branch).toMatchObject({ parentTaskId: source.id, branchDepth: 1, status: 'paused', completedSteps: 0 });
    expect(branch?.id).not.toBe(source.id);
    expect(branch?.traceId).not.toBe(source.traceId);
    expect(branch?.messages).toEqual(source.messages);
    expect(tracer.statuses).toContain('paused');
    branch?.messages.push({ id: 'branch-only', sender: 'user', content: 'branch' });
    expect(source.messages).toHaveLength(1);
  });

  it('rejects forks from running tasks and across workspaces', async () => {
    const repository = new MemoryTaskRepository([task({ status: 'running' })]);
    const service = new AgentTaskService(repository, new MemoryTracer());
    await expect(service.fork('task-1', '/workspace')).rejects.toThrow('đang chạy');
    await expect(service.fork('task-1', '/other')).rejects.toThrow('workspace hiện tại');
  });

  it('bounds branch lineage depth', async () => {
    const repository = new MemoryTaskRepository([task({ branchDepth: 20 })]);
    const service = new AgentTaskService(repository, new MemoryTracer());
    await expect(service.fork('task-1', '/workspace')).rejects.toThrow('20 cấp nhánh');
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
  async recoverInterrupted() { return []; }
  async markPaused(taskId: string, reason?: string) { this.tasks = this.tasks.map((record) => record.id === taskId ? { ...record, status: 'paused', lastError: reason } : record); }
  async markFailed(taskId: string, error: string) { this.tasks = this.tasks.map((record) => record.id === taskId ? { ...record, status: 'failed', lastError: error } : record); }
}

class MemoryTracer implements IAgentTracer {
  statuses: string[] = [];
  newSpanId() { return crypto.randomUUID(); }
  async startTrace() {}
  async updateTrace(_traceId: string, _taskId: string, status: Parameters<IAgentTracer['updateTrace']>[2]) { this.statuses.push(status); }
  async recordSpan() { return this.newSpanId(); }
}

function task(overrides: Partial<AgentTaskRecord> = {}): AgentTaskRecord {
  return {
    id: 'task-1',
    traceId: 'trace-1',
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
