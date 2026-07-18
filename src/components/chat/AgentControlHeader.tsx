import type { AgentControlSnapshot } from '../../application/services/agentControlCenter';

interface AgentControlHeaderProps {
  name?: string;
  description?: string;
  pendingShutdowns?: number;
  metrics: AgentControlSnapshot['metrics'];
  expanded: boolean;
  onToggle: () => void;
}

export function AgentControlHeader(props: AgentControlHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="material-symbols-outlined rounded-lg bg-secondary/10 p-2 text-[20px] text-secondary">hub</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[13px] font-ui-label-bold text-primary">{props.name || 'Agent control center'}</h3>
            {props.metrics.working > 0 && <span className="flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-ui-label-bold text-secondary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />LIVE</span>}
            {!!props.pendingShutdowns && <span className="rounded-full bg-error/10 px-2 py-0.5 text-[10px] text-error">{props.pendingShutdowns} chờ tắt</span>}
          </div>
          {props.description && <p className="mt-0.5 truncate text-[11px] text-on-surface-variant">{props.description}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-on-surface-variant">
            <Metric value={props.metrics.total} label="agent" />
            <Metric value={props.metrics.working} label="đang chạy" accent />
            <Metric value={props.metrics.idle} label="chờ" />
            <Metric value={props.metrics.completed} label="xong" />
            {props.metrics.attention > 0 && <Metric value={props.metrics.attention} label="cần xử lý" warning />}
          </div>
        </div>
      </div>
      <button type="button" onClick={props.onToggle} className="rounded-md p-1.5 text-on-surface-variant hover:bg-surface-container" aria-label={props.expanded ? 'Thu gọn agent control center' : 'Mở agent control center'}>
        <span className="material-symbols-outlined text-[19px]">{props.expanded ? 'expand_less' : 'expand_more'}</span>
      </button>
    </header>
  );
}

function Metric({ value, label, accent, warning }: { value: number; label: string; accent?: boolean; warning?: boolean }) {
  return <span className={`rounded-full border px-2 py-0.5 ${warning ? 'border-error/30 bg-error/5 text-error' : accent ? 'border-secondary/30 bg-secondary/5 text-secondary' : 'border-outline-variant/60 bg-surface'}`}><strong>{value}</strong> {label}</span>;
}
