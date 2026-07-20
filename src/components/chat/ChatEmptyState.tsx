export function ChatEmptyState() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center px-8 pb-24 pt-16 text-center">
      <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl border border-outline-variant/60 bg-surface shadow-sm">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">deployed_code</span>
      </div>
      <h3 className="max-w-[620px] text-[22px] font-medium tracking-[-0.03em] text-on-surface">Chúng ta nên xây dựng gì trong AgentStudio?</h3>
    </div>
  );
}
