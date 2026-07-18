import {
  AGENT_TEAM_PROTOCOL_LEADER,
  AGENT_TEAM_PROTOCOL_VERSION,
  type AgentTeamProtocolMessage,
  type AgentTeamProtocolPayload,
} from '../../domain/entities/agentTeamProtocol.js';
import { parseAgentTeamProtocolMessage, parseAgentTeamProtocolPayload } from '../../domain/entities/agentTeamProtocolParser.js';
import { assertAgentTeamProtocolDirection } from '../../domain/entities/agentTeamProtocolPolicy.js';
import type { AuthenticatedAgentTeamPeer, AgentTeamTransportFrame } from '../../domain/entities/agentTeamTransport.js';
import type { IAgentTeamProtocolStore } from '../../domain/ports/IAgentTeamProtocolStore.js';
import type { IAgentTeamRepository } from '../../domain/ports/IAgentTeamRepository.js';
import type { IAgentTeamTransport } from '../../domain/ports/IAgentTeamTransport.js';

export type AgentTeamProtocolLocalDelivery = (message: AgentTeamProtocolMessage) => Promise<void>;
type ActiveClaim = { teamId: string; messageId: string; leaseId: string; workerId: string; recipient: string };

export class AgentTeamProtocolRouter {
  private readonly store: IAgentTeamProtocolStore;
  private readonly teams: IAgentTeamRepository;
  private readonly transport: IAgentTeamTransport;
  private readonly deliveries = new Map<string, AgentTeamProtocolLocalDelivery>();
  private readonly activeClaims = new Map<string, ActiveClaim>();
  private readonly queues = new Map<string, Promise<void>>();
  private defaultDelivery?: AgentTeamProtocolLocalDelivery;

  constructor(store: IAgentTeamProtocolStore, teams: IAgentTeamRepository, transport: IAgentTeamTransport) {
    this.store = store; this.teams = teams; this.transport = transport;
  }

  async start(defaultDelivery?: AgentTeamProtocolLocalDelivery) {
    this.defaultDelivery = defaultDelivery;
    await this.transport.start((peer, frame) => this.receive(peer, frame));
  }

  async dispatch(rawMessage: AgentTeamProtocolMessage, localDelivery?: AgentTeamProtocolLocalDelivery) {
    const message = parseAgentTeamProtocolMessage(rawMessage);
    await this.assertAuthorized(message);
    if (localDelivery) this.deliveries.set(key(message.teamId, message.id), localDelivery);
    await this.store.append(message);
    await this.pump(message.teamId, message.to);
    return message;
  }

  async shutdown() {
    this.activeClaims.clear(); this.deliveries.clear(); this.queues.clear();
    await this.transport.shutdown();
  }

  private async receive(peer: AuthenticatedAgentTeamPeer, frame: AgentTeamTransportFrame) {
    if (frame.type === 'heartbeat') { await this.pumpPeer(peer); return; }
    if (frame.type === 'ack') { await this.ack(peer, frame.messageId); return; }
    const { team, member } = await this.authenticatedMember(peer);
    const payload = parseWirePayload(frame.payload);
    const targets = frame.recipient === '*'
      ? team.members.filter((candidate) => candidate.name !== member.name).map((candidate) => candidate.name)
      : [frame.recipient];
    if (targets.length === 0 || (frame.recipient === '*' && payload.type !== 'message')) {
      throw new Error('Structured agent team protocol messages cannot be broadcast.');
    }
    for (const [index, recipient] of targets.entries()) {
      await this.dispatch({
        version: AGENT_TEAM_PROTOCOL_VERSION,
        id: targets.length === 1 ? frame.messageId : `${frame.messageId}:${index}`,
        teamId: team.id, from: member.name, to: recipient,
        createdAt: new Date().toISOString(), payload,
      });
    }
  }

  private async pumpPeer(peer: AuthenticatedAgentTeamPeer) {
    const { member } = await this.authenticatedMember(peer);
    await this.pump(peer.teamId, member.name);
  }

  private async ack(peer: AuthenticatedAgentTeamPeer, messageId: string) {
    const active = this.activeClaims.get(key(peer.teamId, messageId));
    if (!active || active.workerId !== peer.workerId) throw new Error('Agent team protocol ACK does not match its recipient.');
    if (await this.store.ack(active.teamId, active.messageId, active.leaseId)) {
      this.activeClaims.delete(key(active.teamId, active.messageId));
      this.deliveries.delete(key(active.teamId, active.messageId));
    }
    await this.pump(active.teamId, active.recipient);
  }

  private pump(teamId: string, recipient: string) {
    const queueKey = key(teamId, recipient);
    const previous = this.queues.get(queueKey) ?? Promise.resolve();
    const operation = previous.catch(() => undefined).then(() => this.pumpExclusive(teamId, recipient));
    const settled = operation.then(() => undefined, () => undefined);
    this.queues.set(queueKey, settled);
    settled.finally(() => { if (this.queues.get(queueKey) === settled) this.queues.delete(queueKey); });
    return operation;
  }

  private async pumpExclusive(teamId: string, recipient: string) {
    const team = (await this.teams.list()).find((candidate) => candidate.id === teamId);
    const member = team?.members.find((candidate) => candidate.name === recipient);
    if (!team || !member) throw new Error('Agent team protocol recipient is unavailable.');
    while (true) {
      const claim = await this.store.claim(teamId, recipient, `router:${member.workerId ?? AGENT_TEAM_PROTOCOL_LEADER}`);
      if (!claim) return;
      if (member.workerId && await this.transport.send(member.workerId, claim.message.id, JSON.stringify(claim.message))) {
        this.activeClaims.set(key(teamId, claim.message.id), {
          teamId, messageId: claim.message.id, leaseId: claim.leaseId,
          workerId: member.workerId, recipient,
        });
        return;
      }
      const delivery = this.deliveries.get(key(teamId, claim.message.id)) ?? this.defaultDelivery;
      if (!delivery) { await this.store.release(teamId, claim.message.id, claim.leaseId); return; }
      try {
        await delivery(claim.message);
        await this.store.ack(teamId, claim.message.id, claim.leaseId);
        this.deliveries.delete(key(teamId, claim.message.id));
      } catch (error) {
        await this.store.release(teamId, claim.message.id, claim.leaseId);
        throw error;
      }
    }
  }

  private async assertAuthorized(message: AgentTeamProtocolMessage) {
    const team = (await this.teams.list()).find((candidate) => candidate.id === message.teamId);
    const sender = team?.members.find((member) => member.name === message.from);
    const recipient = team?.members.find((member) => member.name === message.to);
    if (!team || !sender || !recipient) throw new Error('Agent team protocol membership is invalid.');
    assertAgentTeamProtocolDirection(
      message,
      sender.name === AGENT_TEAM_PROTOCOL_LEADER ? 'leader' : 'teammate',
      recipient.name === AGENT_TEAM_PROTOCOL_LEADER ? 'leader' : 'teammate',
    );
  }

  private async authenticatedMember(peer: AuthenticatedAgentTeamPeer) {
    const team = (await this.teams.list()).find((candidate) => candidate.id === peer.teamId);
    const member = team?.members.find((candidate) => candidate.workerId === peer.workerId);
    if (!team || !member) throw new Error('Authenticated agent is no longer a team member.');
    return { team, member };
  }
}

function parseWirePayload(serialized: string): AgentTeamProtocolPayload {
  if (serialized.length > 150_000) throw new Error('Agent team protocol payload is too large.');
  try { return parseAgentTeamProtocolPayload(JSON.parse(serialized) as unknown); }
  catch (error) { throw error instanceof Error ? error : new Error('Agent team protocol payload is invalid.'); }
}

function key(teamId: string, value: string) { return `${teamId}\0${value}`; }
