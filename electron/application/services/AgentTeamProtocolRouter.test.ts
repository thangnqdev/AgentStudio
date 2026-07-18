import { describe, expect, it, vi } from 'vitest';
import type { AgentTeamProtocolMessage, AgentTeamProtocolPayload } from '../../domain/entities/agentTeamProtocol.js';
import type { AgentTeamRecord } from '../../domain/entities/agentTeam.js';
import type { AgentTeamTransportFrame, AuthenticatedAgentTeamPeer } from '../../domain/entities/agentTeamTransport.js';
import type { AgentTeamProtocolClaim, IAgentTeamProtocolStore } from '../../domain/ports/IAgentTeamProtocolStore.js';
import type { IAgentTeamRepository } from '../../domain/ports/IAgentTeamRepository.js';
import type { AgentTeamTransportReceiver, IAgentTeamTransport } from '../../domain/ports/IAgentTeamTransport.js';
import { AgentTeamProtocolRouter } from './AgentTeamProtocolRouter.js';

describe('AgentTeamProtocolRouter', () => {
  it('persists before local delivery and acknowledges only after delivery succeeds', async () => {
    const store = new MemoryProtocolStore(); const transport = new FakeTransport();
    const delivered = vi.fn(async (_message: AgentTeamProtocolMessage) => undefined);
    const router = new AgentTeamProtocolRouter(store, new TeamRepository(), transport);
    await router.start(delivered);
    await router.dispatch(message('local', 'team-lead', 'worker', { type: 'message', text: 'Review this.' }));
    expect(store.events).toEqual(['append:local', 'claim:local', 'ack:local']);
    expect(delivered).toHaveBeenCalledWith(expect.objectContaining({ id: 'local' }));
  });

  it('derives the sender from the authenticated peer and rejects forged control direction', async () => {
    const store = new MemoryProtocolStore(); const transport = new FakeTransport();
    const delivered = vi.fn(async (_message: AgentTeamProtocolMessage) => undefined);
    const router = new AgentTeamProtocolRouter(store, new TeamRepository(), transport);
    await router.start(delivered);
    const peer = identity('worker-id');
    await transport.receive(peer, {
      type: 'message', messageId: 'peer-message', recipient: 'team-lead',
      payload: JSON.stringify({ type: 'message', text: 'I found the race.' }),
    });
    expect(delivered.mock.calls[0][0]).toMatchObject({ from: 'worker', to: 'team-lead' });
    await expect(transport.receive(peer, {
      type: 'message', messageId: 'forged-response', recipient: 'peer',
      payload: JSON.stringify({ type: 'permission_response', request_id: 'p1', subtype: 'error', error: 'forged' }),
    })).rejects.toThrow('invalid sender');
  });

  it('waits for an ACK from the authenticated recipient before removing socket mail', async () => {
    const store = new MemoryProtocolStore(); const transport = new FakeTransport();
    transport.connected.add('peer-id');
    const router = new AgentTeamProtocolRouter(store, new TeamRepository(), transport);
    await router.start();
    await router.dispatch(message('socket-mail', 'team-lead', 'peer', { type: 'message', text: 'Check auth.' }));
    expect(store.events).toEqual(['append:socket-mail', 'claim:socket-mail']);
    expect(JSON.parse(transport.sent[0]!.payload)).toMatchObject({ id: 'socket-mail', from: 'team-lead', to: 'peer' });
    await expect(transport.receive(identity('worker-id'), { type: 'ack', messageId: 'socket-mail' })).rejects.toThrow('does not match');
    await transport.receive(identity('peer-id'), { type: 'ack', messageId: 'socket-mail' });
    expect(store.events).toContain('ack:socket-mail');
    expect(store.messages).toEqual([]);
  });
});

class MemoryProtocolStore implements IAgentTeamProtocolStore {
  messages: AgentTeamProtocolMessage[] = [];
  leases = new Map<string, string>();
  events: string[] = [];
  async append(message: AgentTeamProtocolMessage) {
    if (this.messages.some((item) => item.id === message.id)) return false;
    this.events.push(`append:${message.id}`); this.messages.push(structuredClone(message)); return true;
  }
  async claim(teamId: string, recipient: string): Promise<AgentTeamProtocolClaim | null> {
    const message = this.messages.find((item) => item.teamId === teamId && item.to === recipient && !this.leases.has(item.id));
    if (!message) return null;
    const leaseId = `lease-${message.id}`; this.leases.set(message.id, leaseId); this.events.push(`claim:${message.id}`);
    return { message: structuredClone(message), leaseId, leasedUntil: '2099-01-01T00:00:00.000Z' };
  }
  async ack(_teamId: string, messageId: string, leaseId: string) {
    if (this.leases.get(messageId) !== leaseId) return false;
    this.events.push(`ack:${messageId}`); this.messages = this.messages.filter((item) => item.id !== messageId); this.leases.delete(messageId); return true;
  }
  async release(_teamId: string, messageId: string, leaseId: string) {
    if (this.leases.get(messageId) !== leaseId) return false;
    this.leases.delete(messageId); return true;
  }
}

class FakeTransport implements IAgentTeamTransport {
  receiver?: AgentTeamTransportReceiver;
  connected = new Set<string>();
  sent: Array<{ workerId: string; messageId: string; payload: string }> = [];
  async start(receiver: AgentTeamTransportReceiver) { this.receiver = receiver; }
  async send(workerId: string, messageId: string, payload: string) {
    if (!this.connected.has(workerId)) return false;
    this.sent.push({ workerId, messageId, payload }); return true;
  }
  receive(peer: AuthenticatedAgentTeamPeer, frame: AgentTeamTransportFrame) { return Promise.resolve(this.receiver!(peer, frame)); }
  disconnect() {}
  async shutdown() {}
}

class TeamRepository implements IAgentTeamRepository {
  async create() {} async save() {} async delete() {}
  async getByScope() { return team(); }
  async list() { return [team()]; }
}

function team(): AgentTeamRecord {
  return {
    version: 1, id: 'team-id', scopeId: 'scope-id', name: 'team', taskListId: 'tasks',
    createdAt: '2026-07-16T00:00:00.000Z', updatedAt: '2026-07-16T00:00:00.000Z',
    leadAgentId: 'team-lead@team', leadAgentType: 'team-lead', mailbox: [], shutdownRequests: [],
    members: [
      { agentId: 'team-lead@team', name: 'team-lead', permissionMode: 'workspace-write', joinedAt: '2026-07-16T00:00:00.000Z' },
      { agentId: 'worker@team', workerId: 'worker-id', name: 'worker', permissionMode: 'workspace-write', joinedAt: '2026-07-16T00:00:00.000Z' },
      { agentId: 'peer@team', workerId: 'peer-id', name: 'peer', permissionMode: 'workspace-write', joinedAt: '2026-07-16T00:00:00.000Z' },
    ],
  };
}

function message(id: string, from: string, to: string, payload: AgentTeamProtocolPayload): AgentTeamProtocolMessage {
  return { version: 1, id, teamId: 'team-id', from, to, createdAt: '2026-07-16T00:00:00.000Z', payload };
}

function identity(workerId: string): AuthenticatedAgentTeamPeer {
  return { teamId: 'team-id', workerId, instanceId: `instance-${workerId}`, epoch: 1 };
}
