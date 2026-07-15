import type { PermissionMode } from '../../domain/entities/agent.js';
import type { AgentTeamMessage, AgentTeamRecord } from '../../domain/entities/agentTeam.js';
import {
  MAX_AGENT_TEAM_MEMBERS,
  MAX_AGENT_TEAM_MESSAGES,
  MAX_AGENT_TEAM_SHUTDOWN_REQUESTS,
  TEAM_LEAD_NAME,
  summarizeAgentTeam,
} from '../../domain/entities/agentTeam.js';
import type { AgentWorkItem } from '../../domain/entities/agentWorkItem.js';
import type { AgentWorkerSpawnRequest, SendMessageRequest } from '../../domain/entities/agentWorker.js';
import type { IAgentTeamEventSink } from '../../domain/ports/IAgentTeamEventSink.js';
import type { IAgentTeamRepository } from '../../domain/ports/IAgentTeamRepository.js';
import type { CreateAgentTeamInput } from '../services/agentTeamInput.js';
import type { ManageAgentWorkItems } from './ManageAgentWorkItems.js';
import type { AgentWorkerExecution, AgentWorkerParentContext, ManageAgentWorkers } from './ManageAgentWorkers.js';

export type AgentTeamContext = {
  scopeId: string;
  workspaceRoot: string;
  permissionMode: PermissionMode;
  parentAgentId?: string;
  depth: number;
};

export class ManageAgentTeams {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly repository: IAgentTeamRepository;
  private readonly workers: ManageAgentWorkers;
  private readonly workItems: ManageAgentWorkItems;
  private readonly events: IAgentTeamEventSink;
  private readonly now: () => string;

  constructor(
    repository: IAgentTeamRepository,
    workers: ManageAgentWorkers,
    workItems: ManageAgentWorkItems,
    events: IAgentTeamEventSink = { emitTeam: () => undefined },
    now = () => new Date().toISOString(),
  ) {
    this.repository = repository; this.workers = workers; this.workItems = workItems; this.events = events; this.now = now;
  }

  get(scopeId: string) { return this.repository.getByScope(scopeId); }

  async taskListId(scopeId: string) {
    return (await this.repository.getByScope(scopeId))?.taskListId ?? scopeId;
  }

  async view(scopeId: string) {
    const team = await this.repository.getByScope(scopeId);
    if (!team) return null;
    const workerState = new Map((await this.workers.list(scopeId)).map((worker) => [worker.id, {
      status: worker.status, completedSteps: worker.completedSteps,
    }]));
    return summarizeAgentTeam(team, workerState);
  }

  create(input: CreateAgentTeamInput, context: AgentTeamContext) {
    return this.exclusive('__team_create__', () => this.exclusive(context.scopeId, async () => {
      if (context.parentAgentId) throw new Error('Only a team lead can create a team.');
      if (await this.repository.getByScope(context.scopeId)) throw new Error('Only one active team is allowed in this session.');
      const names = new Set((await this.repository.list()).map((team) => team.name.toLowerCase()));
      const name = uniqueName(input.teamName, names);
      const id = crypto.randomUUID();
      const timestamp = this.now();
      const leadAgentId = `${TEAM_LEAD_NAME}@${name}`;
      const team: AgentTeamRecord = {
        version: 1, id, scopeId: context.scopeId, name, taskListId: `team:${id}`,
        ...(input.description ? { description: input.description } : {}), createdAt: timestamp, updatedAt: timestamp,
        leadAgentId, leadAgentType: input.agentType ?? TEAM_LEAD_NAME,
        members: [{
          agentId: leadAgentId, name: TEAM_LEAD_NAME, agentType: input.agentType ?? TEAM_LEAD_NAME,
          permissionMode: context.permissionMode, joinedAt: timestamp,
        }], mailbox: [], shutdownRequests: [],
      };
      await this.repository.create(team);
      await this.emit(context.scopeId);
      return structuredClone(team);
    }));
  }

  delete(context: AgentTeamContext) {
    return this.exclusive(context.scopeId, async () => {
      if (context.parentAgentId) throw new Error('Only a team lead can delete a team.');
      const team = await this.requireTeam(context.scopeId);
      const workerState = new Map((await this.workers.list(context.scopeId)).map((worker) => [worker.id, worker.status]));
      const active = team.members.filter((member) => member.workerId && workerState.get(member.workerId) === 'running');
      if (active.length) throw new Error(`Cannot delete team while teammates are active: ${active.map((item) => item.name).join(', ')}.`);
      await this.workItems.clear(team.taskListId);
      await this.repository.delete(context.scopeId);
      this.events.emitTeam(context.scopeId, null);
      return team;
    });
  }

  spawn(request: AgentWorkerSpawnRequest, context: AgentTeamContext, execution: AgentWorkerExecution) {
    return this.exclusive(context.scopeId, async () => {
      if (context.parentAgentId) throw new Error('Teammates cannot spawn additional named teammates.');
      const team = await this.requireTeam(context.scopeId);
      if (!request.name) throw new Error('A teammate name is required.');
      if (request.teamName && request.teamName !== team.name) throw new Error(`Current team is "${team.name}".`);
      if (team.members.length >= MAX_AGENT_TEAM_MEMBERS) throw new Error(`Team member limit exceeded (${MAX_AGENT_TEAM_MEMBERS}).`);
      const existingWorkers = await this.workers.list(context.scopeId);
      const usedNames = new Set([
        ...team.members.map((member) => member.name.toLowerCase()),
        ...existingWorkers.flatMap((worker) => worker.name ? [worker.name.toLowerCase()] : []),
      ]);
      const name = uniqueName(request.name, usedNames);
      const parent = this.workerParent(context);
      const launched = await this.workers.spawn({
        ...request, name, teamName: team.name, runInBackground: true,
      }, parent, execution);
      const worker = launched.worker;
      team.members.push({
        agentId: `${name}@${team.name}`, workerId: worker.id, name,
        ...(request.subagentType ? { agentType: request.subagentType } : {}),
        ...(request.model ? { model: request.model } : {}), permissionMode: worker.permissionMode, joinedAt: this.now(),
      });
      await this.save(team);
      return { worker, team: structuredClone(team) };
    });
  }

  send(request: SendMessageRequest, context: AgentTeamContext, execution: AgentWorkerExecution) {
    return this.exclusive(context.scopeId, async () => {
      const team = await this.requireTeam(context.scopeId);
      const sender = senderName(team, context.parentAgentId);
      const targets = teamTargets(team, request.to, sender);
      if (targets.length === 0) throw new Error(`No teammate named "${request.to}" exists.`);
      if (typeof request.message !== 'string' && request.to === '*') throw new Error('Structured messages cannot be broadcast.');
      const outcomes: string[] = [];
      for (const target of targets) outcomes.push(await this.deliver(team, sender, target, request, context, execution));
      await this.save(team);
      return outcomes;
    });
  }

  assignTask(scopeId: string, item: AgentWorkItem, context: AgentTeamContext, execution: AgentWorkerExecution) {
    return this.exclusive(scopeId, async () => {
      if (!item.owner) return;
      const team = await this.requireTeam(scopeId);
      const sender = senderName(team, context.parentAgentId);
      if (item.owner === sender) return;
      await this.deliver(team, sender, item.owner, {
        to: item.owner, summary: `Task ${item.id} assigned by ${sender}`,
        message: `You are assigned task #${item.id}: ${item.subject}\n${item.description}`,
      }, context, execution);
      const latest = team.mailbox.at(-1);
      if (latest?.to === item.owner) latest.kind = 'task_assignment';
      await this.save(team);
    });
  }

  private async deliver(team: AgentTeamRecord, sender: string, target: string, request: SendMessageRequest, context: AgentTeamContext, execution: AgentWorkerExecution) {
    let message = request.message;
    let kind: AgentTeamMessage['kind'] = 'message';
    if (typeof message !== 'string' && message.type === 'shutdown_request') {
      if (target === TEAM_LEAD_NAME) throw new Error('A teammate cannot request shutdown of the team lead.');
      const id = crypto.randomUUID();
      if (team.shutdownRequests.length >= MAX_AGENT_TEAM_SHUTDOWN_REQUESTS) {
        const resolved = team.shutdownRequests.findIndex((item) => item.status !== 'pending');
        if (resolved < 0) throw new Error('Too many shutdown requests are awaiting responses.');
        team.shutdownRequests.splice(resolved, 1);
      }
      team.shutdownRequests.push({ id, from: sender, to: target, status: 'pending', ...(message.reason ? { reason: message.reason } : {}), createdAt: this.now() });
      message = { ...message, request_id: id }; kind = 'shutdown_request';
    } else if (typeof message !== 'string' && message.type === 'shutdown_response') {
      const response = message;
      if (target !== TEAM_LEAD_NAME || sender === TEAM_LEAD_NAME) throw new Error('Only a teammate can send a shutdown response to the team lead.');
      const shutdown = team.shutdownRequests.find((item) => item.id === response.request_id && item.to === sender && item.status === 'pending');
      if (!shutdown) throw new Error('Shutdown request is unavailable or already answered.');
      shutdown.status = response.approve ? 'approved' : 'rejected'; shutdown.respondedAt = this.now(); shutdown.responseReason = response.reason;
      kind = 'shutdown_response';
    } else if (typeof message !== 'string') {
      if (sender !== TEAM_LEAD_NAME || target === TEAM_LEAD_NAME) throw new Error('Only the team lead can send a plan approval response.');
      kind = 'plan_approval_response';
    }
    if (kind === 'shutdown_request' || kind === 'shutdown_response') {
      team.updatedAt = this.now();
      await this.repository.save(team);
    }
    const delivery = target === TEAM_LEAD_NAME ? 'parent' : target;
    const outcomes = await this.workers.send({ ...request, to: delivery, message }, this.workerParent(context), execution);
    if (team.mailbox.length >= MAX_AGENT_TEAM_MESSAGES) team.mailbox.shift();
    team.mailbox.push({
      id: crypto.randomUUID(), from: sender, to: target, kind,
      content: typeof message === 'string' ? message : JSON.stringify(message),
      ...(request.summary ? { summary: request.summary } : {}), createdAt: this.now(), deliveredAt: this.now(),
    });
    return outcomes.join(', ');
  }

  private workerParent(context: AgentTeamContext): AgentWorkerParentContext {
    return { parentScopeId: context.scopeId, ...(context.parentAgentId ? { parentAgentId: context.parentAgentId } : {}), workspaceRoot: context.workspaceRoot, permissionMode: context.permissionMode, depth: context.depth };
  }

  private async requireTeam(scopeId: string) { const team = await this.repository.getByScope(scopeId); if (!team) throw new Error('Create a team before using team coordination.'); return team; }
  private async save(team: AgentTeamRecord) { team.updatedAt = this.now(); await this.repository.save(team); await this.emit(team.scopeId); }
  private async emit(scopeId: string) { this.events.emitTeam(scopeId, await this.view(scopeId)); }
  private exclusive<T>(scopeId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(scopeId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const settled = result.then(() => undefined, () => undefined);
    this.queues.set(scopeId, settled); settled.finally(() => { if (this.queues.get(scopeId) === settled) this.queues.delete(scopeId); });
    return result;
  }
}

function uniqueName(base: string, used: Set<string>) {
  if (!used.has(base.toLowerCase())) return base;
  for (let index = 2; index <= 999; index += 1) { const suffix = `-${index}`; const value = `${base.slice(0, 64 - suffix.length)}${suffix}`; if (!used.has(value.toLowerCase())) return value; }
  throw new Error('Could not allocate a unique team name.');
}
function senderName(team: AgentTeamRecord, parentAgentId?: string) {
  if (!parentAgentId) return TEAM_LEAD_NAME;
  const member = team.members.find((item) => item.workerId === parentAgentId);
  if (!member) throw new Error('Current agent is not a member of this team.');
  return member.name;
}
function teamTargets(team: AgentTeamRecord, recipient: string, sender: string) {
  if (recipient === '*') return team.members.map((member) => member.name).filter((name) => name !== sender);
  if (recipient === 'parent') return sender === TEAM_LEAD_NAME ? [] : [TEAM_LEAD_NAME];
  return team.members.some((member) => member.name === recipient) && recipient !== sender ? [recipient] : [];
}
