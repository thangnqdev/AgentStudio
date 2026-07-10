export function ChatEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-24 gap-4">
      <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center mb-2">
        <span className="material-symbols-outlined text-[32px] text-on-primary-container">smart_toy</span>
      </div>
      <h3 className="font-display-serif text-summary-title text-primary">Sẵn sàng làm việc</h3>
      <p className="font-ui-body text-ui-body text-on-surface-variant max-w-sm">
        Hãy mô tả những gì bạn muốn xây dựng, giải thích hoặc refactor. Kéo thả file vào đây để thêm ngữ cảnh.
      </p>
    </div>
  );
}
