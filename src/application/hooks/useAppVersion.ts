import { useEffect, useState } from 'react';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';

export function useAppVersion() {
  const [version, setVersion] = useState('');

  useEffect(() => {
    AgentBridge.getAppVersion()
      .then(setVersion)
      .catch(() => setVersion(''));
  }, []);

  return version;
}
