import { useWebSearch } from '../../application/hooks/useWebSearch';
import { useWorkspaceNavigation } from '../../application/hooks/useWorkspaceNavigation';

export function BrowserWorkspaceView() {
  const { settings, error } = useWebSearch();
  const { createTask, openSurface, isTaskSwitchLocked } = useWorkspaceNavigation();
  const connector = settings.provider === 'disabled' ? 'Chưa cấu hình' : settings.provider;

  return (
    <div className="flex-1 overflow-y-auto bg-surface px-8 py-10">
      <div className="mx-auto max-w-[820px]">
        <header className="mb-8 border-b border-outline-variant/60 pb-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-on-surface-variant">Web workspace</p>
          <h2 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-on-surface">Trình duyệt</h2>
          <p className="mt-2 max-w-[620px] text-[13px] leading-5 text-on-surface-variant">
            Tạo tác vụ nghiên cứu dùng web search connector của AgentStudio. Nội dung web vẫn đi qua policy và tool approval của agent.
          </p>
        </header>
        <div className="grid grid-cols-[1fr_280px] gap-4 max-[760px]:grid-cols-1">
          <section className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-5">
            <div className="mb-7 flex h-10 w-10 items-center justify-center rounded-xl bg-surface shadow-sm ring-1 ring-outline-variant/60">
              <span className="material-symbols-outlined text-[20px]">travel_explore</span>
            </div>
            <h3 className="text-[16px] font-medium text-on-surface">Bắt đầu nghiên cứu web</h3>
            <p className="mt-2 text-[12px] leading-5 text-on-surface-variant">Agent có thể tìm kiếm, đọc nguồn và tổng hợp kết quả ngay trong một task riêng.</p>
            <button type="button" onClick={() => createTask()} disabled={isTaskSwitchLocked} title={isTaskSwitchLocked ? 'Hãy đợi hoặc dừng agent trước khi đổi tác vụ' : undefined} className="mt-5 rounded-lg bg-primary px-3.5 py-2 text-[12px] font-medium text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45">
              Tạo tác vụ nghiên cứu
            </button>
          </section>
          <aside className="rounded-xl border border-outline-variant/60 bg-surface p-5">
            <p className="text-[11px] uppercase tracking-[0.06em] text-on-surface-variant">Connector</p>
            <p className="mt-2 text-[14px] font-medium capitalize text-on-surface">{connector}</p>
            <p className="mt-1 text-[11px] text-on-surface-variant">{settings.hasApiKey ? 'API key đã sẵn sàng' : 'Chưa có API key'}</p>
            {error && <p className="mt-3 text-[11px] text-error">{error}</p>}
            <button type="button" onClick={() => openSurface('settings')} className="mt-5 flex items-center gap-1.5 text-[12px] font-medium text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-[15px]">settings</span>
              Cấu hình web search
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
