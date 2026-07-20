import { useWebSearch } from '../../application/hooks/useWebSearch';
import { useWorkspaceTabs } from '../../application/hooks/useWorkspaceTabs';

export function DockBrowserView() {
  const { settings, error } = useWebSearch();
  const { createTask, openSurface } = useWorkspaceTabs();
  const ready = settings.provider !== 'disabled' && settings.hasApiKey;
  return (
    <div className="flex-1 overflow-y-auto bg-surface p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container"><span className="material-symbols-outlined text-[20px] text-on-surface-variant">travel_explore</span></div>
      <h3 className="mt-4 text-[15px] font-semibold text-on-surface">Nghiên cứu web</h3>
      <p className="mt-2 text-[11px] leading-5 text-on-surface-variant">Tạo tác vụ để agent tìm kiếm, đọc nguồn và tổng hợp thông tin cho bạn.</p>
      <div className={`mt-5 rounded-lg border p-3 ${ready ? 'border-success/40 bg-success-container' : 'border-warning/40 bg-warning-container'}`}>
        <p className="text-[10px] font-medium text-on-surface-variant">{ready ? 'Đã sẵn sàng' : 'Cần thiết lập trước'}</p>
        <p className="mt-1 text-[10px] text-on-surface-variant">Nguồn tìm kiếm: {settings.provider === 'disabled' ? 'chưa chọn' : settings.provider}</p>
        {error && <p className="mt-2 text-[10px] text-on-error-container">{error}</p>}
      </div>
      <button type="button" onClick={() => createTask()} className="mt-4 w-full rounded-lg bg-primary px-3 py-2 text-[11px] font-medium text-on-primary hover:bg-primary/90">Tạo tác vụ nghiên cứu</button>
      <button type="button" onClick={() => openSurface('settings')} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-outline-variant/60 px-3 py-2 text-[11px] text-on-surface-variant hover:bg-surface-container-low"><span className="material-symbols-outlined text-[15px]">settings</span>Thiết lập tìm kiếm</button>
    </div>
  );
}
