import { describe, expect, it } from 'vitest';
import type { AgentTeamRecord } from '../../domain/entities/agentTeam.js';
import type { AgentTeamProtocolMessage } from '../../domain/entities/agentTeamProtocol.js';
import type { IAgentTeamRepository } from '../../domain/ports/IAgentTeamRepository.js';
import { AgentTeamProtocolQueueDelivery, formatAgentTeamProtocolMessage } from './AgentTeamProtocolQueueDelivery.js';

describe('AgentTeamProtocolQueueDelivery', () => {
  it('persists teammate mail to a worker queue and escapes model-facing attributes', async () => {
    const queued: unknown[] = [];
    const delivery = new AgentTeamProtocolQueueDelivery(new TeamRepository(), workerRepository({ queued }));
    await delivery.deliver(message('team-lead', 'worker', 'Review <auth>.', 'unsafe"summary'));
    expect(queued).toEqual([expect.objectContaining({
      id: 'worker-id',
      message: expect.objectContaining({ content: expect.stringContaining('summary="unsafe&quot;summary"') }),
    })]);
  });

  it('persists worker-to-leader mail as a parent notification', async () => {
    const notifications: unknown[] = [];
    const delivery = new AgentTeamProtocolQueueDelivery(new TeamRepository(), workerRepository({ notifications }));
    await delivery.deliver(message('worker', 'team-lead', 'Done.'));
    expect(notifications).toEqual([expect.objectContaining({ parentScopeId: 'scope-id', agentId: 'worker-id', agentName: 'worker' })]);
    expect(formatAgentTeamProtocolMessage(message('worker', 'team-lead', 'Done.'))).toContain('<teammate-message teammate_id="worker">');
  });
});

function workerRepository(sinks: { queued?: unknown[]; notifications?: unknown[] }) {
  return {
    create: async () => undefined, get: async () => null, list: async () => [], saveCheckpoint: async () => undefined,
    enqueueMessage: async (id: string, value: unknown) => { sinks.queued?.push({ id, message: value }); },
    drainMessages: async () => [],
    addNotification: async (value: unknown) => { sinks.notifications?.push(value); },
    drainNotifications: async () => [], recoverInterrupted: async () => [],
  };
}

class TeamRepository implements IAgentTeamRepository {
  async create() {} async save() {} async delete() {} async getByScope() { return team(); } async list() { return [team()]; }
}

function team(): AgentTeamRecord {
  return {
    version: 1, id: 'team-id', scopeId: 'scope-id', name: 'team', taskListId: 'tasks', leadAgentId: 'lead-id', leadAgentType: 'lead',
    createdAt: '2026-07-16T00:00:00.000Z', updatedAt: '2026-07-16T00:00:00.000Z', mailbox: [], shutdownRequests: [],
    members: [
      { agentId: 'lead-id', name: 'team-lead', permissionMode: 'workspace-write', joinedAt: '2026-07-16T00:00:00.000Z' },
      { agentId: 'worker-agent', workerId: 'worker-id', name: 'worker', permissionMode: 'workspace-write', joinedAt: '2026-07-16T00:00:00.000Z' },
    ],
  };
}

function message(from: string, to: string, text: string, summary?: string): AgentTeamProtocolMessage {
  return {
    version: 1, id: 'message-id', teamId: 'team-id', from, to, createdAt: '2026-07-16T00:00:00.000Z',
    ...(summary ? { summary } : {}), payload: { type: 'message', text },
  };
}
