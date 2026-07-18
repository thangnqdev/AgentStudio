import { AGENT_TEAM_PROTOCOL_VERSION, AGENT_TEAM_PROTOCOL_LEADER, type AgentTeamIdleNotification } from '../../domain/entities/agentTeamProtocol.js';
import type { AgentWorkerSummary } from '../../domain/entities/agentWorker.js';
import type { IAgentTeamRepository } from '../../domain/ports/IAgentTeamRepository.js';
import type { AgentTeamProtocolRouter } from '../services/AgentTeamProtocolRouter.js';
import type { ILifecycleHookDispatcher } from '../../domain/ports/ILifecycleHookDispatcher.js';

export class PublishAgentTeamIdle {
  private readonly teams: IAgentTeamRepository;
  private readonly protocol: AgentTeamProtocolRouter;
  private readonly hooks?: ILifecycleHookDispatcher;

  constructor(teams: IAgentTeamRepository, protocol: AgentTeamProtocolRouter, hooks?: ILifecycleHookDispatcher) {
    this.teams = teams; this.protocol = protocol; this.hooks = hooks;
  }

  async execute(worker: AgentWorkerSummary) {
    if (!worker.name || !worker.teamName || worker.status === 'running') return false;
    const team = await this.teams.getByScope(worker.parentScopeId);
    const member = team?.members.find((candidate) => candidate.workerId === worker.id && candidate.name === worker.name);
    if (!team || !member) return false;
    const payload = idlePayload(worker);
    await this.protocol.dispatch({
      version: AGENT_TEAM_PROTOCOL_VERSION,
      id: `idle:${worker.id}:${worker.updatedAt}`,
      teamId: team.id, from: member.name, to: AGENT_TEAM_PROTOCOL_LEADER,
      createdAt: worker.updatedAt, ...(payload.summary ? { summary: payload.summary } : {}), payload,
    });
    await this.hooks?.dispatch({
      event: 'TeammateIdle', workspaceRoot: worker.workspaceRoot, matchValue: worker.name,
      requestId: worker.id, taskId: worker.id,
    }).catch(() => undefined);
    return true;
  }
}

function idlePayload(worker: AgentWorkerSummary): AgentTeamIdleNotification {
  const summary = (worker.resultPreview || worker.error || `${worker.name || worker.id} is ${worker.status}.`).slice(0, 160);
  if (worker.status === 'completed') {
    return { type: 'idle_notification', from: worker.name!, timestamp: worker.updatedAt, idleReason: 'available', summary, completedStatus: 'resolved' };
  }
  if (worker.status === 'failed') {
    return {
      type: 'idle_notification', from: worker.name!, timestamp: worker.updatedAt, idleReason: 'failed', summary,
      completedStatus: 'failed', ...(worker.error ? { failureReason: worker.error.slice(0, 2_000) } : {}),
    };
  }
  return { type: 'idle_notification', from: worker.name!, timestamp: worker.updatedAt, idleReason: 'interrupted', summary, completedStatus: 'blocked' };
}
