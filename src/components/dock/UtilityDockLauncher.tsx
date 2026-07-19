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
    <div ref={menuRef} className="absolute right-2 top-10 z-50 w-[280px] rounded-xl border border-black/10 bg-white p-1.5 shadow-[0_14px_42px_rgba(0,0,0,0.18)]">
      <p className="px-2.5 pb-1.5 pt-1 text-[10px] font-medium uppercase tracking-wide text-[#999]">Mở trong cánh phải</p>
      {UTILITY_DOCK_OPTIONS.map((option) => (
        <button key={option.surface} type="button" onClick={() => {
          props.onClose();
          if (option.surface === 'activity') props.onOpenActivity();
          else props.onOpenTool(option.surface);
        }} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-[#f3f3f3]">
          <span className="material-symbols-outlined text-[17px] text-[#666]">{option.icon}</span>
          <span className="min-w-0 flex-1"><span className="block text-[12px] text-[#303030]">{option.label}</span><span className="block truncate text-[10px] text-[#999]">{option.description}</span></span>
          {option.shortcut && <kbd className="text-[10px] text-[#aaa]">{option.shortcut}</kbd>}
        </button>
      ))}
    </div>
  );
}
