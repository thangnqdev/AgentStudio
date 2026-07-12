import type { AgentStartPayload, Message } from '../../domain/entities/agent.js';
import type { AgentTaskCheckpoint, AgentTaskRecord } from '../../domain/entities/agentTask.js';
import { MAX_AGENT_TASK_STEPS } from '../../domain/entities/limits.js';
import type { IAgentTaskRepository } from '../../domain/ports/IAgentTaskRepository.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';

export class AgentTaskService {
  private readonly repository: IAgentTaskRepository;
  private readonly tracer: IAgentTracer;

  constructor(repository: IAgentTaskRepository, tracer: IAgentTracer) {
    this.repository = repository;
    this.tracer = tracer;
  }

  async create(payload: AgentStartPayload, workspaceRoot: string, knowledgeContext: string) {
    const messages = sanitizeMessages(payload.messages);
    const latestUserMessage = [...messages].reverse().find((message) => message.sender === 'user');
    const taskId = crypto.randomUUID();
    const traceId = crypto.randomUUID();
    const task: AgentTaskRecord = {
      id: taskId,
      traceId,
      title: toTitle(latestUserMessage?.content),
      workspaceRoot,
      status: 'running',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedSteps: 0,
      messages,
      conversation: [],
      knowledgeContext,
    };
    await this.tracer.startTrace(traceId, taskId);
    await this.repository.create(task);
    return task;
  }

  async resume(taskId: string, workspaceRoot: string) {
    const task = await this.repository.get(taskId);
    if (!task || task.workspaceRoot !== workspaceRoot) {
      throw new Error('Không tìm thấy tác vụ có thể tiếp tục trong workspace hiện tại.');
    }
    if (task.status === 'completed') throw new Error('Tác vụ này đã hoàn tất.');
    if (task.status === 'running') throw new Error('Tác vụ này đang chạy.');
    if (task.completedSteps >= MAX_AGENT_TASK_STEPS) throw new Error(`Tác vụ đã dùng hết ngân sách ${MAX_AGENT_TASK_STEPS} bước.`);

    const traceId = task.traceId || crypto.randomUUID();
    if (task.traceId) await this.tracer.updateTrace(traceId, task.id, 'running');
    else await this.tracer.startTrace(traceId, task.id);
    const resumed: AgentTaskRecord = { ...task, traceId, status: 'running', updatedAt: new Date().toISOString(), lastError: undefined };
    await this.repository.saveCheckpoint(resumed);
    return resumed;
  }

  async checkpoint(checkpoint: AgentTaskCheckpoint) {
    await this.repository.saveCheckpoint(checkpoint);
    await this.recordCheckpoint(checkpoint);
  }

  async listResumable(workspaceRoot: string) {
    return this.repository.listResumable(workspaceRoot);
  }

  async recoverInterrupted() {
    const recovered = await this.repository.recoverInterrupted();
    for (const task of recovered) await this.recordCheckpoint(task);
  }

  async pause(taskId: string, reason?: string) {
    await this.repository.markPaused(taskId, reason);
    const task = await this.repository.get(taskId);
    if (task) await this.recordCheckpoint(task);
  }

  async fail(taskId: string, error: string) {
    await this.repository.markFailed(taskId, error);
    const task = await this.repository.get(taskId);
    if (task) await this.recordCheckpoint(task);
  }

  private async recordCheckpoint(checkpoint: AgentTaskCheckpoint) {
    const timestamp = new Date().toISOString();
    const spanStatus = checkpoint.status === 'completed' ? 'succeeded' : checkpoint.status;
    await this.tracer.recordSpan({ kind: 'checkpoint', traceId: checkpoint.traceId, taskId: checkpoint.id, step: checkpoint.completedSteps, startedAt: timestamp, endedAt: timestamp, status: spanStatus, checkpointStatus: checkpoint.status, completedSteps: checkpoint.completedSteps }).catch(() => undefined);
    if (checkpoint.status !== 'running') await this.tracer.updateTrace(checkpoint.traceId, checkpoint.id, spanStatus).catch(() => undefined);
  }
}

function sanitizeMessages(messages: Message[] | undefined) {
  return Array.isArray(messages) ? messages.filter((message): message is Message =>
    typeof message === 'object' && message !== null &&
    (message.sender === 'user' || message.sender === 'agent') &&
    typeof message.content === 'string' && typeof message.id === 'string',
  ) : [];
}

function toTitle(content: string | undefined) {
  const normalized = (content || 'Tác vụ agent').replace(/\s+/g, ' ').trim();
  return normalized.slice(0, 96) || 'Tác vụ agent';
}
