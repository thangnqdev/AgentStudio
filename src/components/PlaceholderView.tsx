import type { ViewId } from '../store/useAppStore';

interface ViewConfig {
  icon: string;
  title: string;
  description: string;
}

type PlaceholderViewId = Exclude<ViewId, 'tasks' | 'settings' | 'observability' | 'evaluations' | 'workflows' | 'capabilities' | 'optimizer'>;

const VIEW_CONFIGS: Record<PlaceholderViewId, ViewConfig> = {
  workspace: {
    icon: 'folder_open',
    title: 'Không gian làm việc',
    description: 'Mở một thư mục dự án để duyệt mã nguồn, quản lý tệp và cấu hình ngữ cảnh cho AI.',
  },
  knowledge: {
    icon: 'menu_book',
    title: 'Cơ sở tri thức',
    description: 'Lưu trữ tài liệu, ghi chú và tài liệu tham khảo để trợ lý AI sử dụng làm ngữ cảnh khi làm việc.',
  },
  files: {
    icon: 'description',
    title: 'Quản lý tệp tin',
    description: 'Duyệt và quản lý các tệp trong không gian làm việc. Điều hướng cấu trúc dự án của bạn một cách dễ dàng.',
  },
  terminal: {
    icon: 'terminal',
    title: 'Trình lệnh',
    description: 'Chạy PowerShell, Command Prompt, zsh, bash hoặc shell hệ thống khác trong workspace hiện tại.',
  },
  agents: {
    icon: 'smart_toy',
    title: 'Trợ lý AI',
    description: 'Cấu hình các trợ lý AI chuyên biệt, quản lý phiên làm việc và theo dõi hoạt động trên các tác vụ.',
  },
};

export function PlaceholderView({ view }: { view: PlaceholderViewId }) {
  const config = VIEW_CONFIGS[view];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center px-12">
      <div className="w-20 h-20 rounded-2xl bg-surface-container border border-outline-variant flex items-center justify-center mb-2">
        <span
          className="material-symbols-outlined text-[40px] text-secondary"
          style={{ fontVariationSettings: "'FILL' 0, 'wght' 200" }}
        >
          {config.icon}
        </span>
      </div>

      <div>
        <h2 className="font-display-serif text-[28px] leading-tight text-primary mb-2">{config.title}</h2>
        <p className="font-ui-body text-ui-body text-on-surface-variant max-w-sm leading-relaxed">
          {config.description}
        </p>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface-variant font-ui-body text-ui-body cursor-not-allowed opacity-60">
          <span className="material-symbols-outlined text-[16px]">construction</span>
          Sắp ra mắt
        </div>
      </div>
    </div>
  );
}
