export function BridgeUnavailableView() {
  return (
    <main className="w-screen h-screen grid place-items-center bg-background text-on-surface p-8">
      <section className="max-w-xl rounded-2xl border border-outline-variant bg-surface-container-lowest p-8 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-error/10 text-error grid place-items-center mb-5">
          <span className="material-symbols-outlined">desktop_access_disabled</span>
        </div>
        <h1 className="font-display-serif text-[30px] text-primary">Không tìm thấy Electron bridge</h1>
        <p className="mt-3 text-on-surface-variant leading-6">
          Giao diện đang chạy ngoài tiến trình Electron hoặc preload chưa khởi tạo. Vì vậy AgentStudio
          không thể lưu provider, đọc workspace hay gọi model — đây không phải lỗi Base URL.
        </p>
        <div className="mt-5 rounded-lg bg-surface-container px-4 py-3 text-[13px] font-code-base">
          Chạy bản desktop đã cài đặt, hoặc dùng <strong>npm run dev</strong> từ thư mục dự án rồi tải lại cửa sổ.
        </div>
      </section>
    </main>
  );
}
