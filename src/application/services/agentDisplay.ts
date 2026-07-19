import type { AgentControlParticipant, AgentControlSnapshot, AgentControlStatus } from './agentControlCenter';
import type { PermissionMode } from '../../domain/entities/settings';

export function agentStatusLabel(status: AgentControlStatus) {
  const labels: Record<AgentControlStatus, string> = {
    active: 'Đang làm việc', idle: 'Sẵn sàng', paused: 'Tạm dừng', completed: 'Hoàn tất',
    failed: 'Gặp lỗi', killed: 'Đã dừng',
  };
  return labels[status];
}

export function agentRoleLabel(role: AgentControlParticipant['role']) {
  return role === 'lead' ? 'Agent chính' : role === 'teammate' ? 'Agent hỗ trợ' : 'Agent phụ';
}

export function permissionModeLabel(mode: PermissionMode) {
  if (mode === 'read-only') return 'Chỉ xem';
  if (mode === 'workspace-write') return 'Chỉnh sửa trong dự án';
  return 'Toàn quyền dự án';
}

export function toolActivityLabel(toolName: string) {
  const normalized = toolName.toLowerCase();
  if (normalized.includes('read') || normalized.includes('search') || normalized.includes('list')) return 'Đang tìm hiểu';
  if (normalized.includes('test') || normalized.includes('eval') || normalized.includes('check')) return 'Đang kiểm tra';
  if (normalized.includes('write') || normalized.includes('edit') || normalized.includes('patch')) return 'Đang chỉnh sửa';
  if (normalized.includes('command') || normalized.includes('shell') || normalized.includes('terminal')) return 'Đang chạy công cụ';
  return 'Đang xử lý';
}

export function agentActivitySummary(metrics: AgentControlSnapshot['metrics'], leadWorking = false) {
  if (metrics.working > 0) return {
    title: 'Đang thực hiện', status: `${metrics.working} đang làm`, dotClass: 'animate-pulse bg-[#a33d1f]',
  };
  if (metrics.attention > 0) return {
    title: 'Cần bạn kiểm tra', status: `${metrics.attention} cần bạn`, dotClass: 'bg-orange-500',
  };
  if (leadWorking) return {
    title: metrics.completed > 0 ? 'Agent chính đang tổng hợp' : 'Agent chính đang thực hiện',
    status: metrics.completed > 0 ? 'Đang tổng hợp' : 'Đang làm',
    dotClass: 'animate-pulse bg-[#a33d1f]',
  };
  if (metrics.total > 0 && metrics.completed === metrics.total) return {
    title: 'Đã hoàn tất', status: 'Đã xong', dotClass: 'bg-green-600',
  };
  return { title: 'Chưa có việc đang chạy', status: 'Đang chờ', dotClass: 'bg-[#a0a0a0]' };
}
