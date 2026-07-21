import type { AgentControlSnapshot } from './agentControlCenter';

export type AgentDockReaction =
  | { kind: 'none' }
  | { kind: 'attention'; participantId: string };

export function getAgentDockReaction(
  previous: AgentControlSnapshot | null,
  current: AgentControlSnapshot,
): AgentDockReaction {
  if (!previous) return { kind: 'none' };
  const previousById = new Map(previous.participants.map((participant) => [participant.id, participant]));
  const needsAttention = current.participants.find((participant) => {
    const before = previousById.get(participant.id);
    return (participant.pendingAction && !before?.pendingAction)
      || (participant.status === 'failed' && before?.status !== 'failed');
  });
  if (needsAttention) return { kind: 'attention', participantId: needsAttention.id };

  return { kind: 'none' };
}
