import { useEffect, useState } from 'react';
import type { AppSettings } from '../../domain/entities/settings';
import { ProviderSettingsBridge } from '../../infrastructure/ipc/providerSettingsBridge';
import { useAppStore } from '../../store/useAppStore';

const LEGACY_SETTINGS_KEY = 'architect-app-settings';

export function useSettingsSync() {
  const setSettings = useAppStore((state) => state.setSettings);
  const setProjectPath = useAppStore((state) => state.setProjectPath);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => ProviderSettingsBridge.onChanged(setSettings), [setSettings]);
  useEffect(() => {
    let cancelled = false;
    if (!ProviderSettingsBridge.isAvailable) { setLoaded(true); return () => { cancelled = true; }; }
    const legacy = readLegacySettings();
    const request = legacy ? ProviderSettingsBridge.importLegacy(legacy) : ProviderSettingsBridge.load();
    void request.then((settings) => {
      if (cancelled) return;
      if (legacy) localStorage.removeItem(LEGACY_SETTINGS_KEY);
      setSettings(settings);
      setProjectPath(settings.workspacePath);
    }).catch((error) => console.error('Failed to load local AI settings', error))
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [setProjectPath, setSettings]);
  return loaded;
}

function readLegacySettings(): AppSettings | null {
  const raw = localStorage.getItem(LEGACY_SETTINGS_KEY);
  if (!raw) return null;
  try { return (JSON.parse(raw) as { state?: { settings?: AppSettings } }).state?.settings ?? null; }
  catch { return null; }
}
