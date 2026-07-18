import type { Message } from '../../domain/entities/agent.js';
import { AGENT_TEAM_PROTOCOL_LEADER, type AgentTeamProtocolMessage } from '../../domain/entities/agentTeamProtocol.js';
import type { IAgentTeamRepository } from '../../domain/ports/IAgentTeamRepository.js';
import type { IAgentTeamControlHandler } from '../../domain/ports/IAgentTeamControlHandler.js';
import type { IAgentWorkerRepository } from '../../domain/ports/IAgentWorkerRepository.js';

export class AgentTeamProtocolQueueDelivery {
  private readonly teams: IAgentTeamRepository;
  private readonly workers: IAgentWorkerRepository;
  private readonly controls?: IAgentTeamControlHandler;

  constructor(teams: IAgentTeamRepository, workers: IAgentWorkerRepository, controls?: IAgentTeamControlHandler) {
    this.teams = teams; this.workers = workers; this.controls = controls;
  }

  async deliver(message: AgentTeamProtocolMessage) {
    if (await this.controls?.handle(message)) return;
    const team = (await this.teams.list()).find((candidate) => candidate.id === message.teamId);
    const sender = team?.members.find((member) => member.name === message.from);
    const recipient = team?.members.find((member) => member.name === message.to);
    if (!team || !sender || !recipient) throw new Error('Agent team protocol delivery membership is invalid.');
    const content = formatAgentTeamProtocolMessage(message);
    if (recipient.name === AGENT_TEAM_PROTOCOL_LEADER) {
      await this.workers.addNotification({
        id: message.id, parentScopeId: team.scopeId,
        agentId: sender.workerId ?? sender.agentId,
        ...(sender.name ? { agentName: sender.name } : {}),
        status: 'paused', message: content, createdAt: message.createdAt,
      });
      return;
    }
    if (!recipient.workerId) throw new Error('Agent team protocol teammate has no worker transcript.');
    const queued: Message = { id: `team-protocol-${message.id}`, sender: 'user', content };
    await this.workers.enqueueMessage(recipient.workerId, queued);
  }
}

export function formatAgentTeamProtocolMessage(message: AgentTeamProtocolMessage) {
  const attributes = [
    `teammate_id="${escapeXml(message.from)}"`,
    ...(message.color ? [`color="${escapeXml(message.color)}"`] : []),
    ...(message.summary ? [`summary="${escapeXml(message.summary)}"`] : []),
  ].join(' ');
  if (message.payload.type === 'message') {
    return `<teammate-message ${attributes}>\n${message.payload.text}\n</teammate-message>`;
  }
  return `<teammate-control ${attributes} type="${message.payload.type}">\n${JSON.stringify(message.payload)}\n</teammate-control>`;
}

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
