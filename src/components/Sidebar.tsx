import { useAppStore, type ViewId } from '../store/useAppStore';

interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'workspace', label: 'Workspace',     icon: 'folder_open' },
  { id: 'tasks',     label: 'Active Tasks',  icon: 'bolt' },
  { id: 'knowledge', label: 'Knowledge Base', icon: 'menu_book' },
  { id: 'files',     label: 'File Explorer', icon: 'description' },
  { id: 'agents',    label: 'Agents',        icon: 'smart_toy' },
];

export function Sidebar() {
  const activeView = useAppStore((s) => s.activeView);
  const setActiveView = useAppStore((s) => s.setActiveView);

  return (
    <nav className="flex flex-col pb-6 px-4 h-screen w-[260px] border-r border-outline-variant bg-surface-container-low/95 backdrop-blur-xl transition-all duration-200 ease-in-out shrink-0">

      {/* Spacer for macOS native traffic lights / draggable region */}
      <div 
        className="w-full h-12 shrink-0" 
        style={{ WebkitAppRegion: 'drag' } as any}
      ></div>

      {/* Header Info */}
      <div className="flex items-center gap-3 px-2 mb-6">
        <div className="w-8 h-8 rounded bg-primary-container text-on-primary flex items-center justify-center font-display-serif text-sm">
          A
        </div>
        <div>
          <h1 className="font-display-serif text-summary-title text-primary leading-tight">Architect</h1>
          <p className="text-on-surface-variant font-ui-label-caps text-ui-label-caps">v1.0.4 Premium</p>
        </div>
      </div>

      {/* Global Search */}
      <div className="px-2 mb-6">
        <button
          id="global-search-btn"
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-highest transition-colors font-ui-body text-ui-body"
        >
          <span className="material-symbols-outlined text-[18px]">search</span>
          <span>Search or jump to...</span>
          <span className="ml-auto font-code-base text-xs border border-outline-variant rounded px-1 text-on-surface-variant/70">⌘K</span>
        </button>
      </div>

      <div className="mb-2 px-2 font-ui-label-caps text-ui-label-caps text-on-surface-variant uppercase tracking-wider">
        Primary Navigation
      </div>

      {/* Nav Items */}
      <ul className="space-y-1 mb-8">
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

      {/* Bottom actions */}
      <div className="mt-auto px-2">
        <button
          id="new-project-btn"
          className="w-full flex justify-center items-center gap-2 py-2 mb-4 bg-primary-container text-on-primary rounded font-ui-label-bold text-ui-label-bold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Project
        </button>

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
            Settings
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors font-ui-body text-ui-body">
            <span className="material-symbols-outlined text-[18px]">help_outline</span>
            Support
          </button>
        </div>
      </div>
    </nav>
  );
}