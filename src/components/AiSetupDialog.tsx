type AiSetupDialogProps = {
  onOpenSettings: () => void;
};

export function AiSetupDialog({ onOpenSettings }: AiSetupDialogProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-overlay px-6 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="ai-setup-title">
      <div className="w-full max-w-[460px] rounded-2xl border border-outline-variant bg-surface p-7 shadow-[0_24px_70px_var(--theme-shadow)]">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-[28px]">smart_toy</span>
        </div>
        <h2 id="ai-setup-title" className="font-ui-label-bold text-[21px] text-on-surface">Cần cấu hình AI trước khi chat</h2>
        <p className="mt-2 text-[14px] leading-6 text-on-surface-variant">
          AgentStudio chưa có provider và model hoạt động. Hãy thêm OpenAI-compatible provider hoặc AI chạy local, quét model rồi chọn model mặc định.
        </p>
        <button type="button" onClick={onOpenSettings} autoFocus className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-ui-label-bold text-[14px] text-on-primary transition-colors hover:bg-primary/90">
          <span className="material-symbols-outlined text-[18px]">settings</span>
          Đi tới Cài đặt
        </button>
      </div>
    </div>
  );
}
