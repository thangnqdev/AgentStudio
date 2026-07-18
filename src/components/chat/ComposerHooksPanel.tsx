import { useLifecycleHooks } from '../../application/hooks/useLifecycleHooks';

interface ComposerHooksPanelProps { onClose: () => void }

export function ComposerHooksPanel(props: ComposerHooksPanelProps) {
  const { hooks, loading, error } = useLifecycleHooks(true);
  return (
    <div className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-xl">
      <div className="flex items-center justify-between border-b border-outline-variant/60 px-4 py-3">
        <div><p className="text-[10px] font-ui-label-bold uppercase tracking-wide text-on-surface-variant">Lifecycle hooks hiệu lực</p><p className="mt-1 text-[11px] text-on-surface-variant">Chỉ hiển thị metadata đã chuẩn hóa; không hiển thị context hoặc reason.</p></div>
        <button type="button" onClick={props.onClose} className="px-2 text-xs text-on-surface-variant">Đóng</button>
      </div>
      <div className="max-h-72 overflow-y-auto p-2">
        {loading && <p className="p-3 text-xs text-on-surface-variant">Đang tải hooks…</p>}
        {!loading && error && <p className="p-3 text-xs text-error">{error}</p>}
        {!loading && !error && hooks.length === 0 && <p className="p-3 text-xs text-on-surface-variant">Workspace hiện tại không có hook được bật.</p>}
        {hooks.map((hook) => (
          <article key={hook.id} className="mb-1 rounded-lg bg-surface-container px-3 py-2 text-xs">
            <div className="flex items-center justify-between gap-3"><strong className="truncate font-code-base">{hook.id}</strong><span className="text-secondary">{hook.event}</span></div>
            <p className="mt-1 text-[11px] text-on-surface-variant">{hook.matcher ? `matcher: ${hook.matcher} · ` : ''}actions: {hook.actionTypes.join(', ')}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
