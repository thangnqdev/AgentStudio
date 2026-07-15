import { useCallback, useEffect, useState } from 'react';
import type { AgentAction } from '../../domain/entities/message';
import type { AgentWorkerEvent, AgentWorkerView } from '../../domain/entities/agentWorker';
import { AgentWorkerBridge } from '../../infrastructure/ipc/agentWorkerBridge';

export function useAgentWorkers(scopeId: string | null) {
  const [workers, setWorkers] = useState<AgentWorkerView[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!scopeId || !AgentWorkerBridge.isAvailable) {
      setWorkers([]);
      return;
    }
    let cancelled = false;
    AgentWorkerBridge.list(scopeId)
      .then((result) => {
        if (cancelled) return;
        if (!result.success) throw new Error(result.error);
        setWorkers((current) => result.data.map((worker) => ({
          ...worker, actions: current.find((item) => item.id === worker.id)?.actions ?? [],
        })));
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Không thể tải agent.'); });
    const cleanup = AgentWorkerBridge.onEvent((event) => {
      if (!cancelled && event.scopeId === scopeId) setWorkers((current) => reduceWorkerEvent(current, event));
    });
    return () => { cancelled = true; cleanup(); };
  }, [scopeId]);

  const stop = useCallback(async (agentId: string) => {
    if (!scopeId) return;
    const result = await AgentWorkerBridge.stop(scopeId, agentId);
    if (!result.success) setError(result.error);
  }, [scopeId]);

  const approve = useCallback((agentId: string, actionId: string, approved: boolean) => {
    AgentWorkerBridge.approve(agentId, actionId, approved);
  }, []);

  return { workers, error, stop, approve };
}

function reduceWorkerEvent(current: AgentWorkerView[], event: AgentWorkerEvent) {
  const existing = current.find((worker) => worker.id === event.worker.id);
  const action = event.action ? ({ ...event.action, requestId: event.worker.id } satisfies AgentAction) : undefined;
  const actions = action ? upsertAction(existing?.actions ?? [], action) : existing?.actions ?? [];
  const next = { ...event.worker, actions };
  return [...current.filter((worker) => worker.id !== next.id), next]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function upsertAction(actions: AgentAction[], action: AgentAction) {
  const exists = actions.some((item) => item.id === action.id);
  return exists ? actions.map((item) => item.id === action.id ? action : item) : [...actions, action];
}
