import type { AgentControlParticipant } from './agentControlCenter';

export type AgentRosterSections = {
  active: AgentControlParticipant[];
  attention: AgentControlParticipant[];
  completed: AgentControlParticipant[];
};

export function partitionAgentRoster(participants: AgentControlParticipant[]): AgentRosterSections {
  const active: AgentControlParticipant[] = [];
  const attention: AgentControlParticipant[] = [];
  const completed: AgentControlParticipant[] = [];
  for (const participant of participants) {
    if (participant.status === 'completed' || participant.status === 'killed') completed.push(participant);
    else if (participant.status === 'failed' || participant.pendingAction) attention.push(participant);
    else active.push(participant);
  }
  return { active, attention, completed };
}
