import { useWebSearch } from '../../application/hooks/useWebSearch';
import { useWorkspaceTabs } from '../../application/hooks/useWorkspaceTabs';

export function DockBrowserView() {
  const { settings, error } = useWebSearch();
  const { createTask, openSurface } = useWorkspaceTabs();
  const ready = settings.provider !== 'disabled' && settings.hasApiKey;
  return (
    <div className="flex-1 overflow-y-auto bg-white p-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f4f4f4]"><span className="material-symbols-outlined text-[20px] text-[#555]">travel_explore</span></div>
      <h3 className="mt-4 text-[15px] font-semibold text-[#292929]">Nghiên cứu web</h3>
      <p className="mt-2 text-[11px] leading-5 text-[#777]">Tạo tác vụ để agent tìm kiếm, đọc nguồn và tổng hợp thông tin cho bạn.</p>
      <div className={`mt-5 rounded-lg border p-3 ${ready ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
        <p className="text-[10px] font-medium text-[#555]">{ready ? 'Đã sẵn sàng' : 'Cần thiết lập trước'}</p>
        <p className="mt-1 text-[10px] text-[#777]">Nguồn tìm kiếm: {settings.provider === 'disabled' ? 'chưa chọn' : settings.provider}</p>
        {error && <p className="mt-2 text-[10px] text-red-700">{error}</p>}
      </div>
      <button type="button" onClick={() => createTask()} className="mt-4 w-full rounded-lg bg-[#252525] px-3 py-2 text-[11px] font-medium text-white hover:bg-black">Tạo tác vụ nghiên cứu</button>
      <button type="button" onClick={() => openSurface('settings')} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-black/[0.08] px-3 py-2 text-[11px] text-[#555] hover:bg-[#fafafa]"><span className="material-symbols-outlined text-[15px]">settings</span>Thiết lập tìm kiếm</button>
    </div>
  );
}
