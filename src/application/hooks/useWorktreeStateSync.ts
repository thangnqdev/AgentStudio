import { useEffect } from 'react';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';
import { useAppStore } from '../../store/useAppStore';

export function useWorktreeStateSync() {
  const activeThreadId = useAppStore((state) => state.activeThreadId);
  const setWorktreeState = useAppStore((state) => state.setWorktreeState);

  useEffect(() => {
    let active = true;
    if (!AgentBridge.isAvailable || !activeThreadId) {
      setWorktreeState({ active: false });
      return () => { active = false; };
    }
    AgentBridge.getAgentWorktreeState(activeThreadId)
      .then((result) => {
        if (active) setWorktreeState(result.success ? result.data : { active: false });
      })
      .catch(() => { if (active) setWorktreeState({ active: false }); });
    return () => { active = false; };
  }, [activeThreadId, setWorktreeState]);
}
