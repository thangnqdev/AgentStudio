import { describe, expect, it } from 'vitest';
import type { AgentTeamView } from '../../domain/entities/agentTeam';
import type { AgentWorkerView } from '../../domain/entities/agentWorker';
import { buildAgentControlSnapshot } from './agentControlCenter';

const team: AgentTeamView = {
  version: 1, id: 'team', scopeId: 'scope', name: 'Review', taskListId: 'tasks',
  createdAt: '2026-07-18T01:00:00.000Z', updatedAt: '2026-07-18T02:00:00.000Z',
  leadAgentId: 'lead@review', leadAgentType: 'team-lead', pendingShutdowns: 0,
  members: [
    { agentId: 'lead@review', name: 'team-lead', permissionMode: 'workspace-write', joinedAt: '2026-07-18T01:00:00.000Z', status: 'active' },
    { agentId: 'tests@review', workerId: 'worker-1', name: 'tests', agentType: 'qa', permissionMode: 'read-only', joinedAt: '2026-07-18T01:05:00.000Z', status: 'active' },
  ],
  recentMessages: [{ id: 'mail-1', from: 'tests', to: 'team-lead', kind: 'message', summary: 'Found a regression', createdAt: '2026-07-18T02:00:00.000Z' }],
};

const worker: AgentWorkerView = {
  id: 'worker-1', traceId: 'trace', parentScopeId: 'scope', name: 'tests', description: 'Run tests',
  subagentType: 'qa', permissionMode: 'read-only', workspaceRoot: '/workspace', depth: 1, background: true,
  status: 'running', createdAt: '2026-07-18T01:05:00.000Z', updatedAt: '2026-07-18T02:01:00.000Z', completedSteps: 3,
  actions: [{ id: 'action', requestId: 'worker-1', toolName: 'Bash', args: 'npm test', risk: 'execute', status: 'awaiting_approval' }],
};

describe('buildAgentControlSnapshot', () => {
  it('merges team roster and live worker state without duplicating teammates', () => {
    const snapshot = buildAgentControlSnapshot(team, [worker]);
    expect(snapshot.participants).toHaveLength(2);
    expect(snapshot.participants[0]).toMatchObject({ role: 'lead', name: 'team-lead' });
    expect(snapshot.participants[1]).toMatchObject({ workerId: 'worker-1', status: 'active', completedSteps: 3, pendingAction: { id: 'action' } });
    expect(snapshot.metrics).toEqual({ total: 2, working: 2, idle: 0, completed: 0, attention: 1 });
  });

  it('includes unteamed subagents and produces a newest-first coordination feed', () => {
    const solo = { ...worker, id: 'worker-2', name: 'security', updatedAt: '2026-07-18T03:00:00.000Z', actions: [] };
    const snapshot = buildAgentControlSnapshot(team, [worker, solo]);
    expect(snapshot.participants.at(-1)).toMatchObject({ id: 'worker-2', role: 'subagent' });
    expect(snapshot.activity[0]).toMatchObject({ kind: 'tool', agentName: 'tests', title: 'Bash' });
    expect(snapshot.activity[1]).toMatchObject({ kind: 'mailbox', detail: 'Found a regression' });
  });
});
