import type { AgentControlStatus } from '../../application/services/agentControlCenter';
import { agentStatusLabel } from '../../application/services/agentDisplay';

const STATUS_META: Record<AgentControlStatus, { label: string; dot: string; chip: string }> = {
  active: { label: agentStatusLabel('active'), dot: 'animate-pulse bg-secondary', chip: 'bg-secondary/10 text-secondary' },
  idle: { label: 'Sẵn sàng', dot: 'bg-success', chip: 'bg-success/10 text-success' },
  paused: { label: 'Tạm dừng', dot: 'bg-warning', chip: 'bg-warning/10 text-warning' },
  completed: { label: 'Hoàn tất', dot: 'bg-success', chip: 'bg-success/10 text-success' },
  failed: { label: 'Gặp lỗi', dot: 'bg-error', chip: 'bg-error/10 text-error' },
  killed: { label: 'Đã dừng', dot: 'bg-outline', chip: 'bg-surface-container-high text-on-surface-variant' },
};

export function AgentStatusIndicator({ status, chip = false }: { status: AgentControlStatus; chip?: boolean }) {
  const meta = STATUS_META[status];
  if (chip) return <span className={`rounded-full px-2 py-0.5 text-[10px] font-ui-label-bold ${meta.chip}`}>{meta.label}</span>;
  return <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} title={meta.label} aria-label={meta.label} />;
}
