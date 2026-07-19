import { useMemo } from 'react';
import { buildAgentControlSnapshot } from '../services/agentControlCenter';
import { useAgentTeam } from './useAgentTeam';
import { useAgentWorkers } from './useAgentWorkers';

export function useAgentControlSnapshot(scopeId: string | null) {
  const { team, error: teamError } = useAgentTeam(scopeId);
  const { workers, error: workerError, stop, approve } = useAgentWorkers(scopeId);
  const snapshot = useMemo(() => buildAgentControlSnapshot(team, workers), [team, workers]);

  return {
    team,
    snapshot,
    error: teamError || workerError,
    stop,
    approve,
  };
}

export type AgentControlViewModel = ReturnType<typeof useAgentControlSnapshot>;
