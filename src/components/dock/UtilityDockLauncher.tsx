import { useEffect, useRef } from 'react';
import type { UtilityDockToolSurface } from './utilityDockOptions';
import { UTILITY_DOCK_OPTIONS } from './utilityDockOptions';

export function UtilityDockLauncher(props: {
  open: boolean;
  onClose: () => void;
  onOpenActivity: () => void;
  onOpenTool: (surface: UtilityDockToolSurface) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!props.open) return;
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) props.onClose();
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [props]);
  if (!props.open) return null;

  return (
    <div ref={menuRef} className="absolute right-2 top-10 z-50 w-[280px] rounded-xl border border-outline-variant/60 bg-surface p-1.5 shadow-[0_14px_42px_var(--theme-shadow)]">
      <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">Mở trong cánh phải</p>
      {UTILITY_DOCK_OPTIONS.map((option) => (
        <button key={option.surface} type="button" onClick={() => {
          props.onClose();
          if (option.surface === 'activity') props.onOpenActivity();
          else props.onOpenTool(option.surface);
        }} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-container">
          <span className="material-symbols-outlined text-[17px] text-on-surface-variant">{option.icon}</span>
          <span className="min-w-0 flex-1"><span className="block text-[12px] text-on-surface">{option.label}</span><span className="block truncate text-[10px] text-on-surface-variant">{option.description}</span></span>
          {option.shortcut && <kbd className="text-[10px] text-on-surface-variant">{option.shortcut}</kbd>}
        </button>
      ))}
    </div>
  );
}
