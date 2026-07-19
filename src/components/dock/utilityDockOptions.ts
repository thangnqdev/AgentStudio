import type { UtilityDockToolSurface } from '../../domain/entities/utilityDock';
export type { UtilityDockToolSurface } from '../../domain/entities/utilityDock';

export const UTILITY_DOCK_OPTIONS: Array<{
  surface: 'activity' | UtilityDockToolSurface;
  label: string;
  description: string;
  icon: string;
  shortcut?: string;
}> = [
  { surface: 'activity', label: 'Hoạt động', description: 'Theo dõi agent và việc đang chạy', icon: 'hub' },
  { surface: 'terminal', label: 'Dòng lệnh', description: 'Mở một phiên lệnh mới', icon: 'terminal', shortcut: '⌘J' },
  { surface: 'browser', label: 'Trình duyệt', description: 'Nghiên cứu và kiểm tra web', icon: 'language', shortcut: '⌘T' },
  { surface: 'files', label: 'Tệp dự án', description: 'Duyệt và xem source', icon: 'folder_open', shortcut: '⌘P' },
  { surface: 'evaluations', label: 'Đánh giá', description: 'Kiểm tra chất lượng kết quả', icon: 'fact_check' },
  { surface: 'task-details', label: 'Chi tiết tác vụ', description: 'Môi trường, quyền và nhánh', icon: 'info' },
];
