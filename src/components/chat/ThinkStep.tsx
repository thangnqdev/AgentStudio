import { useState } from 'react';

export function ThinkStep({ text }: { text: string }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!text.trim()) return null;

  const preview = text.trim().split('\n')[0].slice(0, 120);

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-container-low hover:bg-surface-container transition-colors duration-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-9 w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="material-symbols-outlined text-[16px] text-secondary/80">lightbulb</span>
        <span className="font-ui-label-bold text-[11px] text-on-surface/80">Suy nghĩ</span>
        <span className="ml-1 flex-1 truncate font-ui-body text-[11px] text-on-surface-variant/60">{preview}</span>
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant/50">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-outline-variant/30 bg-surface-container/50 px-3 pb-2.5">
          <div className="whitespace-pre-wrap pt-2.5 font-ui-body text-[12px] italic leading-[1.55] text-on-surface-variant/80">{text}</div>
        </div>
      )}
    </div>
  );
}
