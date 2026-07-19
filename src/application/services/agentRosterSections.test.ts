import { describe, expect, it } from 'vitest';
import type { AgentControlParticipant, AgentControlStatus } from './agentControlCenter';
import { partitionAgentRoster } from './agentRosterSections';

describe('partitionAgentRoster', () => {
  it('keeps active agents first, attention separate, and terminal agents in the completed section', () => {
    const sections = partitionAgentRoster([
      participant('done', 'completed'), participant('working', 'active'),
      participant('failed', 'failed'), participant('stopped', 'killed'),
    ]);
    expect(sections.active.map((item) => item.id)).toEqual(['working']);
    expect(sections.attention.map((item) => item.id)).toEqual(['failed']);
    expect(sections.completed.map((item) => item.id)).toEqual(['done', 'stopped']);
  });
});

function participant(id: string, status: AgentControlStatus): AgentControlParticipant {
  return {
    id, name: id, role: 'subagent', agentType: 'general-purpose', permissionMode: 'read-only',
    status, joinedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', actions: [],
  };
}
