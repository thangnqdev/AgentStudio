import { useEffect, useState } from 'react';
import { AgentBridge } from '../../infrastructure/ipc/agentStudioBridge';
import type { PublicWebSearchSettings, WebSearchProvider } from '../../types/electron';

const EMPTY: PublicWebSearchSettings = { provider: 'disabled', hasApiKey: false };

/**
 * Hook adapter cho web search settings.
 * Tách biệt WebSearchSettings component khỏi AgentBridge trực tiếp.
 */
export function useWebSearch() {
  const [settings, setSettings] = useState<PublicWebSearchSettings>(EMPTY);
  const [error, setError] = useState('');

  useEffect(() => {
    AgentBridge.loadWebSearchSettings()
      .then((result) => {
        if (result.success) setSettings(result.settings);
        else setError(result.error);
      })
      .catch(() => setError('Không thể tải cấu hình web search.'));
  }, []);

  const saveWebSearch = async (nextSettings: PublicWebSearchSettings, apiKey: string): Promise<void> => {
    setError('');
    const result = await AgentBridge.saveWebSearchSettings({ ...nextSettings, apiKey });
    if (!result.success) throw new Error(result.error);
    setSettings(result.settings);
  };

  const updateProvider = (provider: WebSearchProvider) => {
    setSettings((current) => ({
      ...current,
      provider,
      baseUrl: provider === 'tavily' ? 'https://api.tavily.com/search' : provider === 'openai' ? 'https://api.openai.com/v1' : current.baseUrl,
      model: provider === 'openai' ? current.model || 'gpt-5.5' : undefined,
    }));
  };

  const updateSettings = (partial: Partial<PublicWebSearchSettings>) => {
    setSettings((current) => ({ ...current, ...partial }));
  };

  return { settings, error, saveWebSearch, updateProvider, updateSettings };
}
