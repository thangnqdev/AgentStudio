import { useAgentWorkers } from '../../application/hooks/useAgentWorkers';
import { useAppStore } from '../../store/useAppStore';

const STATUS_LABEL = {
  running: 'Đang chạy', paused: 'Đã tạm dừng', completed: 'Hoàn tất', failed: 'Lỗi', killed: 'Đã dừng',
} as const;

export function AgentWorkerPanel() {
  const scopeId = useAppStore((state) => state.activeThreadId);
  const { workers, error, stop, approve } = useAgentWorkers(scopeId);
  if (!workers.length && !error) return null;

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-low p-3" aria-label="Agent workers">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-ui-label-bold text-primary">
        <span className="material-symbols-outlined text-[17px] text-secondary">group_work</span>
        Agent đang phối hợp
        <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] text-on-surface-variant">{workers.length}</span>
      </div>
      {error && <p className="mb-2 text-[11px] text-error">{error}</p>}
      <div className="space-y-2">
        {workers.map((worker) => {
          const pending = worker.actions.find((action) => action.status === 'awaiting_approval');
          return (
            <article key={worker.id} className="rounded-lg border border-outline-variant/60 bg-surface px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${worker.status === 'running' ? 'animate-pulse bg-secondary' : worker.status === 'completed' ? 'bg-[#388e3c]' : 'bg-error'}`} />
                    <span className="truncate font-ui-label-bold text-[12px] text-primary">{worker.name || worker.description}</span>
                    <span className="text-[10px] text-on-surface-variant">{STATUS_LABEL[worker.status]}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-on-surface-variant">{worker.description} · {worker.completedSteps} bước</p>
                </div>
                {worker.status === 'running' && <button type="button" onClick={() => void stop(worker.id)} className="settings-action px-2 py-1 text-[11px]">Dừng</button>}
              </div>
              {pending && (
                <div className="mt-2 rounded-md border border-secondary/40 bg-secondary/5 p-2 text-[11px]">
                  <p className="mb-2 text-primary">{pending.toolName}: {pending.args}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => approve(worker.id, pending.id, true)} className="rounded bg-primary px-2.5 py-1 text-on-primary">Cho phép</button>
                    <button type="button" onClick={() => approve(worker.id, pending.id, false)} className="rounded border border-outline-variant px-2.5 py-1 text-primary">Từ chối</button>
                  </div>
                </div>
              )}
              {(worker.resultPreview || worker.error) && <p className={`mt-2 whitespace-pre-wrap text-[11px] ${worker.error ? 'text-error' : 'text-on-surface-variant'}`}>{worker.resultPreview || worker.error}</p>}
              {worker.worktreePath && <p className="mt-1 truncate font-code-base text-[10px] text-on-surface-variant" title={worker.worktreePath}>{worker.worktreeBranch} · {worker.worktreePath}</p>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
