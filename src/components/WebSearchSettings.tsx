import { useEffect, useState } from 'react';
import { useWebSearch } from '../application/hooks/useWebSearch';
import type { WebSearchProvider } from '../types/electron';

export function WebSearchSettings() {
  const { settings, error: hookError, saveWebSearch, updateProvider, updateSettings } = useWebSearch();
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (hookError) setError(hookError);
  }, [hookError]);

  const save = async () => {
    setError('');
    setSaved(false);
    try {
      await saveWebSearch(settings, apiKey);
      setApiKey('');
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu cấu hình web search.');
    }
  };

  return (
    <section className="border-t border-outline-variant pt-8">
      <div className="mb-4">
        <h3 className="font-ui-label-bold text-[16px] text-primary">Web Search Connector</h3>
        <p className="mt-1 text-[13px] leading-5 text-on-surface-variant">
          Đề xuất: chọn Tavily và lấy API key miễn phí tại{' '}
          <a className="font-ui-label-bold text-secondary underline underline-offset-2" href="https://app.tavily.com" target="_blank" rel="noreferrer">app.tavily.com</a>.
        </p>
      </div>
      <div className="grid gap-4">
        <label className="grid gap-1.5 text-[13px] font-ui-label-bold text-on-surface">
          Connector
          <select className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 font-ui-body" value={settings.provider} onChange={(event) => updateProvider(event.target.value as WebSearchProvider)}>
            <option value="disabled">Tắt</option>
            <option value="tavily">Tavily</option>
            <option value="searxng">SearXNG tự host</option>
            <option value="openai">OpenAI Responses</option>
          </select>
        </label>
        {settings.provider !== 'disabled' && (
          <label className="grid gap-1.5 text-[13px] font-ui-label-bold text-on-surface">
            Base URL
            <input className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 font-ui-body" value={settings.baseUrl || ''} onChange={(event) => updateSettings({ baseUrl: event.target.value })} />
          </label>
        )}
        {settings.provider === 'openai' && (
          <label className="grid gap-1.5 text-[13px] font-ui-label-bold text-on-surface">
            Search model
            <input className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 font-ui-body" value={settings.model || ''} onChange={(event) => updateSettings({ model: event.target.value })} />
          </label>
        )}
        {(settings.provider === 'tavily' || settings.provider === 'openai') && (
          <label className="grid gap-1.5 text-[13px] font-ui-label-bold text-on-surface">
            API key
            <input type="password" className="bg-surface-container border border-outline-variant rounded-lg px-3 py-2 font-ui-body" value={apiKey} placeholder={settings.hasApiKey ? 'Để trống để giữ khóa hiện tại' : ''} onChange={(event) => setApiKey(event.target.value)} />
          </label>
        )}
        <div className="flex items-center gap-3">
          <button type="button" onClick={save} className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-[13px] font-ui-label-bold text-on-primary"><span className="material-symbols-outlined text-[16px]">save</span>Lưu web search</button>
          {saved && <span className="text-[13px] text-[#27642a]">Đã lưu</span>}
          {error && <span className="text-[13px] text-error">{error}</span>}
        </div>
      </div>
    </section>
  );
}
