import type { Message, PermissionMode } from '../../domain/entities/agent.js';
import {
  MAX_AGENT_WORKER_DEPTH,
  resolveChildPermissionMode,
  summarizeAgentWorker,
  type AgentWorkerNotification,
  type AgentWorkerRecord,
  type AgentWorkerSpawnRequest,
  type SendMessageRequest,
} from '../../domain/entities/agentWorker.js';
import type { IAgentTracer } from '../../domain/ports/IAgentTracer.js';
import type { IAgentWorkerEventSink } from '../../domain/ports/IAgentWorkerEventSink.js';
import type { IAgentWorkerRepository } from '../../domain/ports/IAgentWorkerRepository.js';
import type { IAgentWorkerRunner } from '../../domain/ports/IAgentWorkerRunner.js';

export type AgentWorkerExecution = { runner: IAgentWorkerRunner; events: IAgentWorkerEventSink };
export type AgentWorkerParentContext = {
  parentScopeId: string;
  parentAgentId?: string;
  workspaceRoot: string;
  permissionMode: PermissionMode;
  depth: number;
};

type ActiveWorker = { controller: AbortController; promise: Promise<AgentWorkerRecord> };
type AgentWorkerApprovalControl = {
  cancel(requestId: string): void;
  respond(requestId: string, actionId: string, approved: boolean): void;
};

export class ManageAgentWorkers {
  private readonly repository: IAgentWorkerRepository;
  private readonly tracer: IAgentTracer;
  private readonly approvals: AgentWorkerApprovalControl;
  private readonly active = new Map<string, ActiveWorker>();

  constructor(repository: IAgentWorkerRepository, tracer: IAgentTracer, approvals: AgentWorkerApprovalControl = { cancel: () => undefined, respond: () => undefined }) {
    this.repository = repository;
    this.tracer = tracer;
    this.approvals = approvals;
  }

  async spawn(request: AgentWorkerSpawnRequest, parent: AgentWorkerParentContext, execution: AgentWorkerExecution) {
    if (parent.depth >= MAX_AGENT_WORKER_DEPTH) throw new Error(`Agent nesting cannot exceed ${MAX_AGENT_WORKER_DEPTH} levels.`);
    const existing = request.name ? (await this.repository.list(parent.parentScopeId)).find((item) => item.name === request.name) : undefined;
    if (existing) throw new Error(`Agent name "${request.name}" already exists in this scope.`);
    const now = new Date().toISOString();
    const worker: AgentWorkerRecord = {
      id: crypto.randomUUID(), traceId: crypto.randomUUID(), parentScopeId: parent.parentScopeId,
      ...(parent.parentAgentId ? { parentAgentId: parent.parentAgentId } : {}),
      ...(request.name ? { name: request.name } : {}), ...(request.teamName ? { teamName: request.teamName } : {}),
      description: request.description, prompt: request.prompt,
      ...(request.subagentType ? { subagentType: request.subagentType } : {}), ...(request.model ? { model: request.model } : {}),
      permissionMode: resolveChildPermissionMode(parent.permissionMode, request.mode),
      ...(request.isolation ? { isolation: request.isolation } : {}), ...(request.cwd ? { cwd: request.cwd } : {}),
      workspaceRoot: parent.workspaceRoot, depth: parent.depth + 1, background: request.runInBackground,
      status: 'running', createdAt: now, updatedAt: now, completedSteps: 0,
      messages: [{ id: `agent-prompt-${crypto.randomUUID()}`, sender: 'user', content: request.prompt }], conversation: [],
    };
    await this.repository.create(worker);
    await this.tracer.startTrace(worker.traceId, worker.id);
    execution.events.emitWorker(summarizeAgentWorker(worker));
    const promise = this.launch(worker, execution);
    if (request.runInBackground) return { background: true as const, worker: structuredClone(worker) };
    return { background: false as const, worker: await promise };
  }

  async send(request: SendMessageRequest, parent: AgentWorkerParentContext, execution: AgentWorkerExecution) {
    if (request.to === 'parent') return this.sendToParent(request, parent);
    const workers = await this.repository.list(parent.parentScopeId);
    const targets = resolveTargets(workers, request.to, parent.parentAgentId);
    if (targets.length === 0) throw new Error(`No agent named or identified by "${request.to}" exists in this scope.`);
    const outcomes: string[] = [];
    for (const target of targets) {
      const shutdownRequest = typeof request.message !== 'string' && request.message.type === 'shutdown_request';
      if (shutdownRequest && target.status !== 'running') {
        outcomes.push(`${target.name || target.id}: already stopped`);
        continue;
      }
      const content = typeof request.message === 'string' ? request.message : JSON.stringify(request.message);
      const message: Message = { id: `agent-message-${crypto.randomUUID()}`, sender: 'user', content };
      await this.repository.enqueueMessage(target.id, message);
      if (target.status !== 'running') await this.resume(target.id, execution);
      outcomes.push(`${target.name || target.id}: ${shutdownRequest ? 'shutdown requested' : target.status === 'running' ? 'queued' : 'resumed'}`);
    }
    return outcomes;
  }

  async stop(agentId: string, reason = 'Stopped by parent.') {
    const active = this.active.get(agentId);
    if (active) {
      active.controller.abort(reason);
      return true;
    }
    const worker = await this.repository.get(agentId);
    if (!worker || worker.status !== 'running') return false;
    await this.finish(worker, 'killed', '', reason);
    return true;
  }

  async stopInScope(parentScopeId: string, agentId: string) {
    const worker = await this.repository.get(agentId);
    if (!worker || worker.parentScopeId !== parentScopeId) return false;
    return this.stop(agentId);
  }

  respondToApproval(agentId: string, actionId: string, approved: boolean) {
    this.approvals.respond(agentId, actionId, approved);
    return true;
  }

  async list(parentScopeId: string) {
    return (await this.repository.list(parentScopeId)).map(summarizeAgentWorker);
  }

  async findInScope(parentScopeId: string, agentId: string) {
    const worker = await this.repository.get(agentId);
    return worker?.parentScopeId === parentScopeId ? structuredClone(worker) : undefined;
  }

  async drainParentMessages(parentScopeId: string): Promise<Message[]> {
    return (await this.repository.drainNotifications(parentScopeId)).map((item) => ({
      id: `agent-notification-${item.id}`, sender: 'user' as const,
      content: `<agent-notification agent_id="${item.agentId}" status="${item.status}"${item.agentName ? ` name="${item.agentName}"` : ''}>\n${item.message}\n</agent-notification>`,
    }));
  }

  async recoverInterrupted() {
    const recovered = await this.repository.recoverInterrupted();
    for (const worker of recovered) await this.tracer.updateTrace(worker.traceId, worker.id, 'paused').catch(() => undefined);
    return recovered;
  }

  async stopAll() {
    for (const active of this.active.values()) active.controller.abort('Application is shutting down.');
    await Promise.allSettled([...this.active.values()].map((item) => item.promise));
  }

  private async resume(agentId: string, execution: AgentWorkerExecution) {
    if (this.active.has(agentId)) return this.active.get(agentId)!.promise;
    const worker = await this.repository.get(agentId);
    if (!worker) throw new Error('Agent transcript is unavailable.');
    const pending = await this.repository.drainMessages(agentId);
    if (pending.length === 0) return worker;
    const resumed: AgentWorkerRecord = {
      ...worker, status: 'running', updatedAt: new Date().toISOString(), error: undefined, result: undefined,
      messages: [...worker.messages, ...pending],
      conversation: [...worker.conversation, ...pending.map((message) => ({ role: 'user' as const, content: message.content }))],
    };
    await this.repository.saveCheckpoint(resumed);
    await this.tracer.updateTrace(resumed.traceId, resumed.id, 'running').catch(() => undefined);
    execution.events.emitWorker(summarizeAgentWorker(resumed));
    void this.launch(resumed, execution);
    return resumed;
  }

  private async sendToParent(request: SendMessageRequest, parent: AgentWorkerParentContext) {
    if (!parent.parentAgentId) throw new Error('Only a child agent can send a message to parent.');
    const sender = await this.repository.get(parent.parentAgentId);
    if (!sender) throw new Error('Parent message sender transcript is unavailable.');
    const content = typeof request.message === 'string' ? request.message : JSON.stringify(request.message);
    await this.repository.addNotification({
      id: crypto.randomUUID(), parentScopeId: parent.parentScopeId, agentId: sender.id,
      ...(sender.name ? { agentName: sender.name } : {}), status: 'paused', message: content, createdAt: new Date().toISOString(),
    });
    if (typeof request.message !== 'string' && request.message.type === 'shutdown_response' && request.message.approve) {
      await this.stop(sender.id, 'Agent approved the shutdown request.');
    }
    return [`parent: delivered from ${sender.name || sender.id}`];
  }

  private launch(worker: AgentWorkerRecord, execution: AgentWorkerExecution) {
    const controller = new AbortController();
    const promise = this.run(worker, execution, controller).finally(() => {
      this.approvals.cancel(worker.id);
      this.active.delete(worker.id);
    });
    this.active.set(worker.id, { controller, promise });
    return promise;
  }

  private async run(worker: AgentWorkerRecord, execution: AgentWorkerExecution, controller: AbortController): Promise<AgentWorkerRecord> {
    try {
      const result = await execution.runner.run(worker, {
        checkpoint: (checkpoint) => this.repository.saveCheckpoint(checkpoint),
        drainMessages: () => this.repository.drainMessages(worker.id),
      }, controller.signal);
      const lateMessages = await this.repository.drainMessages(worker.id);
      if (lateMessages.length) {
        const checkpoint = await this.repository.get(worker.id) ?? worker;
        const continued: AgentWorkerRecord = {
          ...checkpoint, status: 'running', updatedAt: new Date().toISOString(), result: undefined, error: undefined,
          messages: [...checkpoint.messages, ...lateMessages],
          conversation: [...checkpoint.conversation, ...lateMessages.map((message) => ({ role: 'user' as const, content: message.content }))],
        };
        await this.repository.saveCheckpoint(continued);
        execution.events.emitWorker(summarizeAgentWorker(continued));
        return this.run(continued, execution, controller);
      }
      const current = await this.repository.get(worker.id) ?? worker;
      const completed = await this.finish(current, result.status, result.result, undefined, result.worktreePath, result.worktreeBranch);
      execution.events.emitWorker(summarizeAgentWorker(completed));
      return completed;
    } catch (error) {
      const current = await this.repository.get(worker.id) ?? worker;
      const aborted = controller.signal.aborted;
      const failed = await this.finish(current, aborted ? 'killed' : 'failed', '', aborted ? String(controller.signal.reason || 'Stopped by parent.') : errorMessage(error));
      execution.events.emitWorker(summarizeAgentWorker(failed));
      return failed;
    }
  }

  private async finish(worker: AgentWorkerRecord, status: 'completed' | 'paused' | 'failed' | 'killed', result: string, error?: string, worktreePath?: string, worktreeBranch?: string) {
    const completed: AgentWorkerRecord = {
      ...worker, status, updatedAt: new Date().toISOString(),
      ...(result ? { result } : {}), ...(error ? { error } : {}),
      ...(worktreePath ? { worktreePath } : {}), ...(worktreeBranch ? { worktreeBranch } : {}),
    };
    await this.repository.saveCheckpoint(completed);
    await this.tracer.updateTrace(completed.traceId, completed.id, status === 'completed' ? 'succeeded' : status === 'killed' ? 'failed' : status).catch(() => undefined);
    if (completed.background) await this.repository.addNotification(toNotification(completed));
    return completed;
  }
}

function toNotification(worker: AgentWorkerRecord): AgentWorkerNotification {
  const status = worker.status === 'running' ? 'paused' : worker.status;
  const message = worker.result || worker.error || `Agent ${status}.`;
  return { id: crypto.randomUUID(), parentScopeId: worker.parentScopeId, agentId: worker.id, ...(worker.name ? { agentName: worker.name } : {}), status, message, createdAt: new Date().toISOString() };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 2_000) : 'Agent failed before producing a result.';
}

function resolveTargets(workers: AgentWorkerRecord[], recipient: string, parentAgentId?: string) {
  if (recipient === '*') return workers.filter((worker) => worker.id !== parentAgentId);
  const identified = workers.find((worker) => worker.id === recipient);
  if (identified) return [identified];
  const named = workers.filter((worker) => worker.name === recipient);
  if (named.length > 1) throw new Error(`Agent name "${recipient}" is ambiguous in this scope.`);
  return named;
}
