import type { AgentControlStatus } from '../../application/services/agentControlCenter';

const STATUS_META: Record<AgentControlStatus, { label: string; dot: string; chip: string }> = {
  active: { label: 'Đang chạy', dot: 'animate-pulse bg-secondary', chip: 'bg-secondary/10 text-secondary' },
  idle: { label: 'Sẵn sàng', dot: 'bg-[#388e3c]', chip: 'bg-[#388e3c]/10 text-[#2e7d32]' },
  paused: { label: 'Tạm dừng', dot: 'bg-[#ed6c02]', chip: 'bg-[#ed6c02]/10 text-[#a64600]' },
  completed: { label: 'Hoàn tất', dot: 'bg-[#388e3c]', chip: 'bg-[#388e3c]/10 text-[#2e7d32]' },
  failed: { label: 'Lỗi', dot: 'bg-error', chip: 'bg-error/10 text-error' },
  killed: { label: 'Đã dừng', dot: 'bg-outline', chip: 'bg-surface-container-high text-on-surface-variant' },
};

export function AgentStatusIndicator({ status, chip = false }: { status: AgentControlStatus; chip?: boolean }) {
  const meta = STATUS_META[status];
  if (chip) return <span className={`rounded-full px-2 py-0.5 text-[10px] font-ui-label-bold ${meta.chip}`}>{meta.label}</span>;
  return <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} title={meta.label} aria-label={meta.label} />;
}
