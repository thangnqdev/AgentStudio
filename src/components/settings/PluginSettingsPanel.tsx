import { usePlugins } from '../../application/hooks/usePlugins';

export function PluginSettingsPanel() {
  const { plugins, loading, error, refresh, setEnabled, setTrusted } = usePlugins();
  return (
    <section className="border-t border-outline-variant pt-8">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-ui-label-bold text-[16px] text-primary">Declarative Plugins</h3>
        <button onClick={() => void refresh()} className="text-[13px] text-secondary hover:underline">Quét lại</button>
      </div>
      <p className="text-[13px] text-on-surface-variant mb-4">
        Đọc manifest <code>.claude-plugin/plugin.json</code> từ userData/plugins và .agentstudio/plugins. Hooks khai báo và LSP stdio được hỗ trợ; plugin phải được tin cậy và bật rõ ràng.
      </p>
      {loading && <p className="text-[13px] text-on-surface-variant">Đang quét plugins…</p>}
      {!loading && plugins.length === 0 && <p className="text-[13px] text-on-surface-variant">Chưa tìm thấy plugin hợp lệ.</p>}
      <div className="grid gap-3">
        {plugins.map((plugin) => (
          <div key={plugin.id} className="p-4 rounded-xl border border-outline-variant bg-surface-container-lowest">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-ui-label-bold text-[14px]">{plugin.name}</h4>
                  {plugin.version && <span className="text-[10px]">v{plugin.version}</span>}
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-surface-container">{plugin.origin}</span>
                </div>
                <p className="text-[12px] text-on-surface-variant mt-1">{plugin.description}</p>
                <p className="text-[11px] text-on-surface-variant mt-2">Thành phần: {plugin.components.join(', ') || 'không có'}</p>
                {plugin.unsupportedComponents.length > 0 && (
                  <p className="text-[11px] text-error mt-1">Chưa kích hoạt: {plugin.unsupportedComponents.join(', ')}</p>
                )}
                <p className="text-[11px] text-on-surface-variant font-code-base mt-1 break-all">{plugin.rootPath}</p>
                <p className="text-[10px] text-on-surface-variant font-code-base mt-1">sha256 {plugin.contentHash.slice(0, 16)}…</p>
              </div>
              <label className="flex items-center gap-2 text-[12px] whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={plugin.enabled}
                  disabled={!plugin.trusted || !plugin.components.some((component) => component === 'hooks' || component === 'lspServers')}
                  onChange={(event) => void setEnabled(plugin.id, event.target.checked)}
                /> Bật plugin
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-4 border-t border-outline-variant pt-3">
              <span className={`text-[12px] ${plugin.trusted ? 'text-[#2e7d32]' : 'text-error'}`}>
                {plugin.trusted ? 'Đã tin cậy đúng content hash.' : 'Chưa tin cậy — plugin không ảnh hưởng runtime.'}
              </span>
              <button onClick={() => void setTrusted(plugin.id, !plugin.trusted)} className="settings-action">
                {plugin.trusted ? 'Thu hồi tin cậy' : 'Tin cậy plugin'}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-[13px] text-error mt-3">{error}</p>}
    </section>
  );
}
