import { useEffect, useState } from 'react';
import { useRemoteTriggerSettings } from '../../application/hooks/useRemoteTriggerSettings';

export function RemoteTriggerSettingsPanel() {
  const state = useRemoteTriggerSettings();
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => { if (state.error) setLocalError(state.error); }, [state.error]);

  const save = async () => {
    setSaved(false); setLocalError('');
    try {
      await state.save({
        enabled: state.settings.enabled,
        baseUrl: state.settings.baseUrl,
        bearerToken: token || undefined,
      });
      setToken(''); setSaved(true);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Không thể lưu Remote Trigger.');
    }
  };

  return (
    <section>
      <h3 className="font-ui-label-bold text-[16px] text-primary">Remote Trigger</h3>
      <p className="mt-1 text-[13px] leading-5 text-on-surface-variant">
        Tắt theo mặc định. Khi bật, agent có thể quản lý trigger qua API đã cấu hình; token được giữ trong main process và không đi vào model hay shell.
      </p>
      {state.loading ? <p className="mt-3 text-[13px] text-on-surface-variant">Đang tải…</p> : (
        <div className="mt-4 grid gap-4">
          <label className="flex items-center gap-2 text-[13px] font-ui-label-bold text-on-surface">
            <input type="checkbox" checked={state.settings.enabled} onChange={(event) => state.setSettings((current) => ({ ...current, enabled: event.target.checked }))} />
            Cho phép công cụ RemoteTrigger
          </label>
          <label className="grid gap-1.5 text-[13px] font-ui-label-bold text-on-surface">
            API base URL
            <input className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 font-ui-body" value={state.settings.baseUrl || ''} placeholder="https://example.com" onChange={(event) => state.setSettings((current) => ({ ...current, baseUrl: event.target.value }))} />
          </label>
          <label className="grid gap-1.5 text-[13px] font-ui-label-bold text-on-surface">
            Bearer token
            <input type="password" className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 font-ui-body" value={token} placeholder={state.settings.hasBearerToken ? 'Để trống để giữ token hiện tại' : ''} onChange={(event) => setToken(event.target.value)} />
          </label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={save} className="rounded-lg bg-primary px-4 py-2 text-[13px] font-ui-label-bold text-on-primary">Lưu Remote Trigger</button>
            {saved && <span className="text-[13px] text-success">Đã lưu</span>}
            {localError && <span className="text-[13px] text-error">{localError}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
