export function TypingIndicator() {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-3 py-1">
      <div className="relative flex justify-center">
        <div className="absolute top-7 bottom-0 w-px bg-outline-variant" />
        <div className="relative z-10 mt-1 w-5 h-5 rounded-full bg-background border border-outline-variant flex items-center justify-center text-secondary">
          <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-secondary font-medium pt-1.5">
        <span className="font-ui-body text-[14px] text-on-surface-variant">AI đang suy nghĩ...</span>
      </div>
    </div>
  );
}
