import { describe, expect, it, vi } from 'vitest';
import type { AgentTeamRecord } from '../../domain/entities/agentTeam.js';
import type { AgentTeamProtocolMessage, AgentTeamProtocolPayload } from '../../domain/entities/agentTeamProtocol.js';
import type { AgentWorkerRecord } from '../../domain/entities/agentWorker.js';
import type { IAgentTeamRepository } from '../../domain/ports/IAgentTeamRepository.js';
import type { IAgentWorkerRepository } from '../../domain/ports/IAgentWorkerRepository.js';
import type { AgentTeamProtocolRouter } from '../services/AgentTeamProtocolRouter.js';
import { ResolveAgentTeamControl } from './ResolveAgentTeamControl.js';

describe('ResolveAgentTeamControl', () => {
  it('routes a permission request through local approval and returns a correlated success', async () => {
    const dispatch = vi.fn(async () => undefined); const actions: unknown[] = []; const approvals: unknown[] = [];
    const resolver = new ResolveAgentTeamControl(
      workers(), new Teams(), { requestApproval: async (request) => { approvals.push(request); return true; } },
      { dispatch } as unknown as AgentTeamProtocolRouter,
      (scopeId, summary, action) => actions.push({ scopeId, summary, action }),
    );
    await expect(resolver.handle(message({
      type: 'permission_request', request_id: 'request-1', agent_id: 'worker', tool_name: 'Bash',
      tool_use_id: 'tool-1', description: 'Run tests', input: { command: 'npm test' }, permission_suggestions: [],
    }))).resolves.toBe(true);
    expect(approvals).toEqual([expect.objectContaining({ requestId: 'worker-id', actionId: 'tool-1', toolName: 'Bash', workspaceRoot: '/workspace' })]);
    expect(actions).toHaveLength(2);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      from: 'team-lead', to: 'worker',
      payload: expect.objectContaining({ type: 'permission_response', request_id: 'request-1', subtype: 'success' }),
    }));
  });

  it('denies sandbox access with exact host correlation and ignores ordinary mail', async () => {
    const dispatch = vi.fn(async () => undefined);
    const resolver = new ResolveAgentTeamControl(
      workers(), new Teams(), { requestApproval: async () => false },
      { dispatch } as unknown as AgentTeamProtocolRouter, () => undefined,
    );
    await resolver.handle(message({
      type: 'sandbox_permission_request', requestId: 'sandbox-1', workerId: 'worker-id', workerName: 'worker',
      hostPattern: { host: 'example.com' }, createdAt: 1,
    }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ type: 'sandbox_permission_response', requestId: 'sandbox-1', host: 'example.com', allow: false }),
    }));
    await expect(resolver.handle(message({ type: 'message', text: 'hello' }))).resolves.toBe(false);
  });
});

class Teams implements IAgentTeamRepository {
  async create() {} async save() {} async delete() {} async getByScope() { return team(); } async list() { return [team()]; }
}

function workers(): IAgentWorkerRepository {
  return {
    create: async () => undefined, get: async (id) => id === 'worker-id' ? worker() : null, list: async () => [worker()],
    saveCheckpoint: async () => undefined, enqueueMessage: async () => undefined, drainMessages: async () => [],
    addNotification: async () => undefined, drainNotifications: async () => [], recoverInterrupted: async () => [],
  };
}

function worker(): AgentWorkerRecord {
  return {
    id: 'worker-id', traceId: 'trace-id', parentScopeId: 'scope-id', name: 'worker', teamName: 'team',
    description: 'Review', prompt: 'Review', permissionMode: 'workspace-write', workspaceRoot: '/workspace', depth: 1,
    background: true, status: 'running', createdAt: '2026-07-16T00:00:00.000Z', updatedAt: '2026-07-16T00:00:00.000Z',
    completedSteps: 0, messages: [], conversation: [],
  };
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

function message(payload: AgentTeamProtocolPayload): AgentTeamProtocolMessage {
  return { version: 1, id: `message-${payload.type}`, teamId: 'team-id', from: 'worker', to: 'team-lead', createdAt: '2026-07-16T00:00:00.000Z', payload };
}
