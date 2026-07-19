import type { AgentControlSnapshot } from './agentControlCenter';

export type AgentDockReaction =
  | { kind: 'none' }
  | { kind: 'first-worker'; participantId: string }
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

  const previousWorkers = previous.participants.filter((participant) => participant.role !== 'lead');
  if (previousWorkers.length > 0) return { kind: 'none' };
  const firstWorker = current.participants.find((participant) => (
    participant.role !== 'lead' && !previousById.has(participant.id)
  ));
  return firstWorker
    ? { kind: 'first-worker', participantId: firstWorker.id }
    : { kind: 'none' };
}
