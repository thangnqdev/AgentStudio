import type { AgentAction } from '../../domain/entities/message';

const STATUS = {
  awaiting_approval: 'Chờ duyệt', denied: 'Từ chối', running: 'Đang chạy', ok: 'Hoàn tất', error: 'Lỗi',
} as const;

export function WorkerActivityTimeline({ actions }: { actions: AgentAction[] }) {
  if (!actions.length) return null;
  return (
    <div className="mt-2 border-t border-outline-variant/40 pt-2" aria-label="Worker tool activity">
      <p className="mb-1.5 text-[10px] font-ui-label-bold uppercase tracking-wide text-on-surface-variant">Hoạt động tool</p>
      <div className="space-y-1">
        {actions.slice(-5).reverse().map((action) => (
          <div key={action.id} className="flex items-center gap-2 text-[10px]">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${action.status === 'ok' ? 'bg-[#388e3c]' : action.status === 'running' ? 'animate-pulse bg-secondary' : action.status === 'awaiting_approval' ? 'bg-[#ed6c02]' : 'bg-error'}`} />
            <span className="shrink-0 font-code-base text-primary">{action.toolName}</span>
            <span className="shrink-0 text-on-surface-variant">{STATUS[action.status]}</span>
            <span className="min-w-0 flex-1 truncate text-on-surface-variant/70" title={action.output || action.args}>{action.output || action.args}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
