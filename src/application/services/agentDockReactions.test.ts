import { describe, expect, it } from 'vitest';
import type { AgentControlParticipant, AgentControlSnapshot } from './agentControlCenter';
import { getAgentDockReaction } from './agentDockReactions';

const participant = (id: string, role: AgentControlParticipant['role'] = 'subagent'): AgentControlParticipant => ({
  id, name: id, role, agentType: 'general-purpose', permissionMode: 'workspace-write', status: 'active',
  joinedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', actions: [],
});
const snapshot = (participants: AgentControlParticipant[]): AgentControlSnapshot => ({
  participants, activity: [], metrics: { total: participants.length, working: 0, idle: 0, completed: 0, attention: 0 },
});

describe('getAgentDockReaction', () => {
  it('does not interrupt the user while hydrating history', () => {
    expect(getAgentDockReaction(null, snapshot([participant('old')]))).toEqual({ kind: 'none' });
  });

  it('opens once for the first newly spawned worker', () => {
    const lead = participant('lead', 'lead');
    expect(getAgentDockReaction(snapshot([lead]), snapshot([lead, participant('worker')]))).toEqual({
      kind: 'first-worker', participantId: 'worker',
    });
  });

  it('prioritizes a new approval request or failure', () => {
    const before = participant('worker');
    const after = { ...before, pendingAction: { id: 'action', requestId: 'worker', toolName: 'run_command', args: 'npm test', risk: 'execute' as const, status: 'awaiting_approval' as const } };
    expect(getAgentDockReaction(snapshot([before]), snapshot([after]))).toEqual({
      kind: 'attention', participantId: 'worker',
    });
  });

  it('keeps subsequent workers in the background', () => {
    expect(getAgentDockReaction(snapshot([participant('one')]), snapshot([participant('one'), participant('two')]))).toEqual({ kind: 'none' });
  });
});
