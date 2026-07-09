import { useAppStore } from '../store/useAppStore';

export function TopAppBar() {
  const projectPath = useAppStore((s) => s.projectPath);

  return (
    <header 
      className="flex justify-between items-center px-6 w-full h-[52px] border-b border-outline-variant bg-surface-dim shrink-0 z-10"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left: Branch/Project Context */}
      <div className="flex items-center gap-3">
        <span className="font-ui-label-bold text-ui-label-bold text-primary">
          {projectPath ?? 'no project'}
        </span>
        <span className="text-outline-variant">/</span>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface border border-outline-variant text-on-surface-variant font-code-base text-code-base">
          <span className="material-symbols-outlined text-[14px]">call_split</span>
          feature/agent-runtime
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          className="p-1.5 rounded hover:bg-surface-container-highest transition-colors text-on-surface-variant"
          title="Project tree"
        >
          <span className="material-symbols-outlined text-[20px]">account_tree</span>
        </button>
        <button
          className="p-1.5 rounded hover:bg-surface-container-highest transition-colors text-on-surface-variant"
          title="History"
        >
          <span className="material-symbols-outlined text-[20px]">history</span>
        </button>
        <button
          className="p-1.5 rounded hover:bg-surface-container-highest transition-colors text-on-surface-variant"
          title="More options"
        >
          <span className="material-symbols-outlined text-[20px]">more_vert</span>
        </button>
      </div>
    </header>
  );
}