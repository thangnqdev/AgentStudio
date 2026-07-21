import type { WorkspaceSurface } from '../../domain/entities/workspaceSurface';

export type WorkspaceLaunchAction = WorkspaceSurface | 'new-task' | 'side-task';

export type WorkspaceLaunchOption = {
  action: WorkspaceLaunchAction;
  label: string;
  description: string;
  icon: string;
  shortcut?: string;
};

export const WORKSPACE_LAUNCH_OPTIONS: WorkspaceLaunchOption[] = [
  { action: 'new-task', label: 'Tác vụ mới', description: 'Bắt đầu làm việc cùng agent', icon: 'edit_square', shortcut: '⌘N' },
  { action: 'evaluations', label: 'Đánh giá', description: 'Kiểm tra chất lượng agent', icon: 'fact_check', shortcut: '⌃⇧G' },
  { action: 'terminal', label: 'Dòng lệnh', description: 'Mở shell trong workspace', icon: 'terminal', shortcut: '⌘J' },
  { action: 'browser', label: 'Trình duyệt', description: 'Thiết lập nghiên cứu web', icon: 'language', shortcut: '⌘T' },
  { action: 'files', label: 'Tệp', description: 'Duyệt và xem trước source', icon: 'folder_open', shortcut: '⌘P' },
  { action: 'side-task', label: 'Tác vụ song song', description: 'Tạo một luồng công việc riêng', icon: 'splitscreen_right', shortcut: '⌥⌘S' },
];
