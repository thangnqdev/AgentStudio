import { useEffect, useRef } from 'react';
import type { AgentControlSnapshot } from '../services/agentControlCenter';
import { getAgentDockReaction } from '../services/agentDockReactions';

export function useAgentDockReactions(
  scopeId: string | null,
  snapshot: AgentControlSnapshot,
  onFirstWorker: () => void,
  onAttention: (participantId: string) => void,
) {
  const scopeRef = useRef(scopeId);
  const previousRef = useRef<AgentControlSnapshot | null>(null);

  useEffect(() => {
    if (scopeRef.current !== scopeId) {
      scopeRef.current = scopeId;
      previousRef.current = snapshot;
      return;
    }
    const reaction = getAgentDockReaction(previousRef.current, snapshot);
    previousRef.current = snapshot;
    if (reaction.kind === 'first-worker') onFirstWorker();
    if (reaction.kind === 'attention') onAttention(reaction.participantId);
  }, [onAttention, onFirstWorker, scopeId, snapshot]);
}
