import type { AgentStartPayload, Message } from '../../domain/entities/agent.js';
import type { AgentTaskCheckpoint, AgentTaskRecord } from '../../domain/entities/agentTask.js';
import { MAX_AGENT_TASK_STEPS } from '../../domain/entities/limits.js';
import type { IAgentTaskRepository } from '../../domain/ports/IAgentTaskRepository.js';

export class AgentTaskService {
  private readonly repository: IAgentTaskRepository;

  constructor(repository: IAgentTaskRepository) {
    this.repository = repository;
  }

  async create(payload: AgentStartPayload, workspaceRoot: string, knowledgeContext: string) {
    const messages = sanitizeMessages(payload.messages);
    const latestUserMessage = [...messages].reverse().find((message) => message.sender === 'user');
    const task: AgentTaskRecord = {
      id: crypto.randomUUID(),
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

    const resumed: AgentTaskRecord = { ...task, status: 'running', updatedAt: new Date().toISOString(), lastError: undefined };
    await this.repository.saveCheckpoint(resumed);
    return resumed;
  }

  async checkpoint(checkpoint: AgentTaskCheckpoint) {
    await this.repository.saveCheckpoint(checkpoint);
  }

  async listResumable(workspaceRoot: string) {
    return this.repository.listResumable(workspaceRoot);
  }

  async recoverInterrupted() {
    await this.repository.recoverInterrupted();
  }

  async pause(taskId: string, reason?: string) {
    await this.repository.markPaused(taskId, reason);
  }

  async fail(taskId: string, error: string) {
    await this.repository.markFailed(taskId, error);
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
