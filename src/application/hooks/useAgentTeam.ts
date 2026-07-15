import { useEffect, useState } from 'react';
import type { AgentTeamView } from '../../domain/entities/agentTeam';
import { AgentTeamBridge } from '../../infrastructure/ipc/agentTeamBridge';

export function useAgentTeam(scopeId: string | null) {
  const [team, setTeam] = useState<AgentTeamView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    setTeam(null);
    if (!scopeId || !AgentTeamBridge.isAvailable) { setTeam(null); return; }
    let cancelled = false;
    let eventReceived = false;
    AgentTeamBridge.get(scopeId).then((result) => {
      if (cancelled) return;
      if (!result.success) throw new Error(result.error);
      if (!eventReceived) setTeam(result.data);
    }).catch((cause) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải trạng thái team.');
    });
    const cleanup = AgentTeamBridge.onEvent((event) => {
      if (!cancelled && event.scopeId === scopeId) { eventReceived = true; setTeam(event.team); }
    });
    return () => { cancelled = true; cleanup(); };
  }, [scopeId]);

  return { team, error };
}
