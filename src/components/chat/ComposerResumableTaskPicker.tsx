import { useResumableTasks } from '../../application/hooks/useResumableTasks';
import { ComposerQuickPicker } from './ComposerQuickPicker';

interface ComposerResumableTaskPickerProps {
  active: boolean;
  onSelect: (taskId: string) => void;
  onClose: () => void;
}

export function ComposerResumableTaskPicker(props: ComposerResumableTaskPickerProps) {
  const { tasks, loading, error } = useResumableTasks(props.active);
  const items = tasks.map((task) => ({
    value: task.id,
    label: task.title || `Task ${task.id.slice(0, 8)}`,
    description: [
      task.status === 'failed' ? 'Lỗi' : 'Tạm dừng',
      `${task.completedSteps}/180 bước`,
      task.updatedAt ? new Date(task.updatedAt).toLocaleString() : '',
    ].filter(Boolean).join(' · '),
    searchText: [task.id, task.lastError].filter(Boolean).join(' '),
  }));

  return (
    <ComposerQuickPicker
      title="Tiếp tục agent task"
      items={items}
      emptyMessage={loading ? 'Đang tải task…' : error || 'Không có task có thể tiếp tục.'}
      searchable
      searchPlaceholder="Tìm theo tiêu đề, lỗi hoặc task ID…"
      onSelect={props.onSelect}
      onClose={props.onClose}
    />
  );
}
