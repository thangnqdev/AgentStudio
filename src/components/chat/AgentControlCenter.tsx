import { useMemo } from 'react';
import { useAgentTeam } from '../../application/hooks/useAgentTeam';
import { useAgentWorkers } from '../../application/hooks/useAgentWorkers';
import { buildAgentControlSnapshot } from '../../application/services/agentControlCenter';
import { useAppStore } from '../../store/useAppStore';
import { AgentControlSurface } from './AgentControlSurface';

export function AgentControlCenter() {
  const scopeId = useAppStore((state) => state.activeThreadId);
  const { team, error: teamError } = useAgentTeam(scopeId);
  const { workers, error: workerError, stop, approve } = useAgentWorkers(scopeId);
  const snapshot = useMemo(() => buildAgentControlSnapshot(team, workers), [team, workers]);
  const error = teamError || workerError;
  if (!snapshot.participants.length && !error) return null;
  return <AgentControlSurface team={team} snapshot={snapshot} error={error} onStop={(id) => void stop(id)} onApprove={approve} />;
}
