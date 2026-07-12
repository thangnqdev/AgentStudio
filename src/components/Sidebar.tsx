import { useAppStore, type ViewId } from '../store/useAppStore';

interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'tasks', label: 'Tác vụ hiện tại', icon: 'bolt' },
  { id: 'knowledge', label: 'Cơ sở tri thức', icon: 'menu_book' },
  { id: 'observability', label: 'Quan sát agent', icon: 'monitoring' },
  { id: 'evaluations', label: 'Đánh giá agent', icon: 'fact_check' },
  { id: 'workflows', label: 'Workflows', icon: 'account_tree' },
  { id: 'capabilities', label: 'Capabilities', icon: 'extension' },
  { id: 'optimizer', label: 'Safe Optimizer', icon: 'tune' },
];

export function Sidebar() {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const threads = useAppStore((s) => s.threads);
  const activeThreadId = useAppStore((s) => s.activeThreadId);
  const createThread = useAppStore((s) => s.createThread);
  const switchThread = useAppStore((s) => s.switchThread);
  const deleteThread = useAppStore((s) => s.deleteThread);

  const isSidebarOpen = useAppStore((s) => s.isSidebarOpen);

  return (
    <nav className={`flex flex-col pb-6 h-full border-outline-variant bg-surface-container-low/95 backdrop-blur-xl transition-all duration-200 ease-in-out shrink-0 overflow-hidden ${isSidebarOpen ? 'w-[260px] px-4 border-r' : 'w-0 px-0 border-r-0'}`}>

      {/* Header Info */}
      <div className="flex items-center gap-3 px-2 mb-6 mt-4">
        <div className="w-8 h-8 rounded bg-primary-container text-on-primary flex items-center justify-center font-display-serif text-sm">
          A
        </div>
        <div>
          <h1 className="font-display-serif text-summary-title text-primary leading-tight">Agent Customer</h1>
          <p className="text-on-surface-variant font-ui-label-caps text-ui-label-caps">v1.0.4 Premium</p>
        </div>
      </div>



      <div className="mb-2 px-2 font-ui-label-caps text-ui-label-caps text-on-surface-variant uppercase tracking-wider">
        Điều hướng chính
      </div>

      {/* Nav Items */}
      <ul className="space-y-1 mb-5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <li key={item.id}>
              <button
                id={`nav-${item.id}`}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors font-ui-body text-ui-body text-left
                  ${isActive
                    ? 'bg-secondary/5 text-primary border-l-2 border-secondary font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container-highest border-l-2 border-transparent'
                  }`}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mb-2 px-2 flex items-center justify-between">
        <span className="font-ui-label-caps text-ui-label-caps text-on-surface-variant uppercase tracking-wider">
          Lịch sử chat
        </span>
        <button
          onClick={() => createThread()}
          className="w-6 h-6 rounded flex items-center justify-center hover:bg-surface-container-high text-on-surface-variant"
          title="Tạo chat mới"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
        </button>
      </div>

      <div className="space-y-1 overflow-y-auto pr-1 mb-4">
        {threads.map((thread) => {
          const isActive = thread.id === activeThreadId;
          return (
            <div key={thread.id} className="group flex items-center gap-1">
              <button
                onClick={() => switchThread(thread.id)}
                className={`min-w-0 flex-1 text-left px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-surface-container-high text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                title={thread.title}
              >
                <div className="truncate text-[13px] font-ui-body">{thread.title}</div>
                <div className="text-[10px] text-on-surface-variant/50">
                  {thread.messages.length} tin nhắn
                </div>
              </button>
              {threads.length > 1 && (
                <button
                  onClick={() => deleteThread(thread.id)}
                  className="w-7 h-7 rounded hidden group-hover:flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error/10"
                  title="Xóa chat"
                >
                  <span className="material-symbols-outlined text-[15px]">delete</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="mt-auto px-2">


        <div className="border-t border-outline-variant pt-4 space-y-1">
          <button
            onClick={() => setActiveView('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors font-ui-body text-ui-body ${activeView === 'settings' ? 'bg-surface-container-high text-primary font-semibold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={activeView === 'settings' ? { fontVariationSettings: "'FILL' 1" } : {}}
            >
              settings
            </span>
            Cài đặt
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors font-ui-body text-ui-body">
            <span className="material-symbols-outlined text-[18px]">help_outline</span>
            Hỗ trợ
          </button>
        </div>
      </div>
    </nav>
  );
}
