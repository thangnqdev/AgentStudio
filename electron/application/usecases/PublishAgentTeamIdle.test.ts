import { describe, expect, it, vi } from 'vitest';
import type { AgentTeamRecord } from '../../domain/entities/agentTeam.js';
import type { AgentWorkerSummary } from '../../domain/entities/agentWorker.js';
import type { IAgentTeamRepository } from '../../domain/ports/IAgentTeamRepository.js';
import type { AgentTeamProtocolRouter } from '../services/AgentTeamProtocolRouter.js';
import { PublishAgentTeamIdle } from './PublishAgentTeamIdle.js';

describe('PublishAgentTeamIdle', () => {
  it('publishes the exact idle envelope once a named teammate completes', async () => {
    const dispatch = vi.fn(async () => undefined);
    const hookDispatch = vi.fn(async () => ({ matchedHookIds: [], contexts: [], auditLabels: [] }));
    const usecase = new PublishAgentTeamIdle(new TeamRepository(), { dispatch } as unknown as AgentTeamProtocolRouter, { dispatch: hookDispatch });
    await expect(usecase.execute(worker())).resolves.toBe(true);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      from: 'worker', to: 'team-lead',
      payload: expect.objectContaining({ type: 'idle_notification', idleReason: 'available', completedStatus: 'resolved' }),
    }));
    expect(hookDispatch).toHaveBeenCalledWith(expect.objectContaining({
      event: 'TeammateIdle', workspaceRoot: '/workspace', matchValue: 'worker', requestId: 'worker-id', taskId: 'worker-id',
    }));
  });

  it('ignores unnamed, running, or non-team workers', async () => {
    const dispatch = vi.fn(async () => undefined);
    const usecase = new PublishAgentTeamIdle(new TeamRepository(), { dispatch } as unknown as AgentTeamProtocolRouter);
    await expect(usecase.execute({ ...worker(), status: 'running' })).resolves.toBe(false);
    await expect(usecase.execute({ ...worker(), teamName: undefined })).resolves.toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

class TeamRepository implements IAgentTeamRepository {
  async create() {} async save() {} async delete() {} async list() { return [team()]; } async getByScope() { return team(); }
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

function worker(): AgentWorkerSummary {
  return {
    id: 'worker-id', traceId: 'trace-id', parentScopeId: 'scope-id', name: 'worker', teamName: 'team',
    description: 'Review', permissionMode: 'workspace-write', workspaceRoot: '/workspace', depth: 1, background: true,
    status: 'completed', createdAt: '2026-07-16T00:00:00.000Z', updatedAt: '2026-07-16T00:01:00.000Z', completedSteps: 2,
    resultPreview: 'Review complete.',
  };
}
