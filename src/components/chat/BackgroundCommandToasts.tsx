import type { BackgroundCommandNotice } from '../../domain/entities/backgroundCommand';
import { useBackgroundCommandNotices } from '../../application/hooks/useBackgroundCommandNotices';
import { useAppStore } from '../../store/useAppStore';

export function BackgroundCommandToasts() {
  const { notices, dismiss } = useBackgroundCommandNotices();
  const threads = useAppStore((state) => state.threads);
  const switchThread = useAppStore((state) => state.switchThread);

  if (notices.length === 0) return null;
  return (
    <aside className="fixed bottom-5 right-5 z-[80] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      {notices.map((notice) => {
        const canOpen = threads.some((thread) => thread.id === notice.scopeId);
        return (
          <div key={notice.id} className="rounded-xl border border-outline-variant bg-surface-container-high p-3 shadow-xl">
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${statusColor(notice.status)}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-on-surface">{statusTitle(notice.status)}</p>
                <p className="mt-0.5 truncate text-xs text-on-surface-variant">{notice.description}</p>
                {notice.error && <p className="mt-1 line-clamp-2 text-xs text-error">{notice.error}</p>}
                <div className="mt-2 flex items-center gap-3">
                  {canOpen && (
                    <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => switchThread(notice.scopeId)}>
                      Mở cuộc hội thoại
                    </button>
                  )}
                  {notice.exitCode !== null && <span className="text-[11px] text-on-surface-variant">Exit {notice.exitCode}</span>}
                </div>
              </div>
              <button
                type="button"
                className="rounded px-1.5 text-base leading-6 text-on-surface-variant hover:bg-surface-container-highest"
                aria-label="Đóng thông báo"
                onClick={() => dismiss(notice.id)}
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
    </aside>
  );
}

function statusTitle(status: BackgroundCommandNotice['status']) {
  if (status === 'completed') return 'Lệnh nền đã hoàn tất';
  if (status === 'stopped') return 'Lệnh nền đã dừng';
  return 'Lệnh nền thất bại';
}

function statusColor(status: BackgroundCommandNotice['status']) {
  if (status === 'completed') return 'bg-emerald-500';
  if (status === 'stopped') return 'bg-amber-500';
  return 'bg-error';
}
