import { useCallback, useEffect, useState } from 'react';

import type { AppUpdateSnapshot } from '../../domain/entities/appUpdate';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';

const INITIAL_SNAPSHOT: AppUpdateSnapshot = { status: 'idle' };

export function useAppUpdate() {
  const [update, setUpdate] = useState<AppUpdateSnapshot>(INITIAL_SNAPSHOT);

  useEffect(() => {
    if (!AgentBridge.isAvailable) return;

    let active = true;
    void AgentBridge.getAppUpdateStatus().then((result) => {
      if (active && result.success) setUpdate(result.data);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!AgentBridge.isAvailable) return;
    return AgentBridge.onAppUpdateStatus(setUpdate);
  }, []);

  const download = useCallback(async () => {
    const result = await AgentBridge.downloadAppUpdate();
    if (result.success) setUpdate(result.data);
  }, []);

  const install = useCallback(async () => {
    await AgentBridge.installAppUpdate();
  }, []);

  return { update, download, install };
}
