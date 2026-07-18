import { useEffect, useState } from 'react';
import type { PublicRemoteTriggerSettings, SaveRemoteTriggerSettingsPayload } from '../../domain/entities/remoteTrigger';
import { RemoteTriggerBridge } from '../../infrastructure/ipc/remoteTriggerBridge';

const DEFAULTS: PublicRemoteTriggerSettings = { enabled: false, hasBearerToken: false };

export function useRemoteTriggerSettings() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    RemoteTriggerBridge.loadSettings()
      .then((result) => result.success ? setSettings(result.data) : setError(result.error))
      .catch(() => setError('Không thể tải cấu hình Remote Trigger.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async (payload: SaveRemoteTriggerSettingsPayload) => {
    setError('');
    const result = await RemoteTriggerBridge.saveSettings(payload);
    if (!result.success) throw new Error(result.error);
    setSettings(result.data);
  };

  return { settings, setSettings, loading, error, setError, save };
}
