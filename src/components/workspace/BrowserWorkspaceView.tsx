import { useWebSearch } from '../../application/hooks/useWebSearch';
import { useWorkspaceTabs } from '../../application/hooks/useWorkspaceTabs';

export function BrowserWorkspaceView() {
  const { settings, error } = useWebSearch();
  const { createTask, openSurface } = useWorkspaceTabs();
  const connector = settings.provider === 'disabled' ? 'Chưa cấu hình' : settings.provider;

  return (
    <div className="flex-1 overflow-y-auto bg-white px-8 py-10">
      <div className="mx-auto max-w-[820px]">
        <header className="mb-8 border-b border-black/[0.08] pb-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#888]">Web workspace</p>
          <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-[#202020]">Trình duyệt</h2>
          <p className="mt-2 max-w-[620px] text-[13px] leading-5 text-[#707070]">
            Tạo tác vụ nghiên cứu dùng web search connector của AgentStudio. Nội dung web vẫn đi qua policy và tool approval của agent.
          </p>
        </header>
        <div className="grid grid-cols-[1fr_280px] gap-4 max-[760px]:grid-cols-1">
          <section className="rounded-xl border border-black/[0.08] bg-[#fafafa] p-5">
            <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/[0.06]">
              <span className="material-symbols-outlined text-[20px]">travel_explore</span>
            </div>
            <h3 className="text-[16px] font-medium text-[#262626]">Bắt đầu nghiên cứu web</h3>
            <p className="mt-2 text-[12px] leading-5 text-[#777]">Agent có thể tìm kiếm, đọc nguồn và tổng hợp kết quả ngay trong một task riêng.</p>
            <button type="button" onClick={() => createTask()} className="mt-5 rounded-lg bg-[#202020] px-3.5 py-2 text-[12px] font-medium text-white hover:bg-black">
              Tạo tác vụ nghiên cứu
            </button>
          </section>
          <aside className="rounded-xl border border-black/[0.08] bg-white p-5">
            <p className="text-[11px] uppercase tracking-[0.06em] text-[#999]">Connector</p>
            <p className="mt-2 text-[14px] font-medium capitalize text-[#2c2c2c]">{connector}</p>
            <p className="mt-1 text-[11px] text-[#888]">{settings.hasApiKey ? 'API key đã sẵn sàng' : 'Chưa có API key'}</p>
            {error && <p className="mt-3 text-[11px] text-error">{error}</p>}
            <button type="button" onClick={() => openSurface('settings')} className="mt-5 flex items-center gap-1.5 text-[12px] font-medium text-[#555] hover:text-black">
              <span className="material-symbols-outlined text-[15px]">settings</span>
              Cấu hình web search
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
