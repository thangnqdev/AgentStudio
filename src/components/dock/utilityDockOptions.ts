import type { UtilityDockSurface, UtilityDockToolSurface } from '../../domain/entities/utilityDock';
export type { UtilityDockToolSurface } from '../../domain/entities/utilityDock';

export const UTILITY_DOCK_ICONS: Record<UtilityDockSurface, string> = {
  activity: 'monitoring',
  agent: 'smart_toy',
  terminal: 'terminal',
  browser: 'travel_explore',
  files: 'folder_open',
  evaluations: 'fact_check',
  'task-details': 'assignment',
};

export const UTILITY_DOCK_OPTIONS: Array<{
  surface: 'activity' | UtilityDockToolSurface;
  label: string;
  description: string;
  icon: string;
  shortcut?: string;
}> = [
  { surface: 'activity', label: 'Hoạt động', description: 'Theo dõi agent và việc đang chạy', icon: UTILITY_DOCK_ICONS.activity },
  { surface: 'terminal', label: 'Dòng lệnh', description: 'Mở một phiên lệnh mới', icon: UTILITY_DOCK_ICONS.terminal, shortcut: '⌘J' },
  { surface: 'browser', label: 'Trình duyệt', description: 'Nghiên cứu và kiểm tra web', icon: UTILITY_DOCK_ICONS.browser, shortcut: '⌘T' },
  { surface: 'files', label: 'Tệp dự án', description: 'Duyệt và xem source', icon: UTILITY_DOCK_ICONS.files, shortcut: '⌘P' },
  { surface: 'evaluations', label: 'Đánh giá', description: 'Kiểm tra chất lượng kết quả', icon: UTILITY_DOCK_ICONS.evaluations },
  { surface: 'task-details', label: 'Chi tiết tác vụ', description: 'Môi trường, quyền và nhánh', icon: UTILITY_DOCK_ICONS['task-details'] },
];
