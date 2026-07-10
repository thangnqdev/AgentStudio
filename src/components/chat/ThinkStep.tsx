import { useState } from 'react';

export function ThinkStep({ text }: { text: string }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!text.trim()) return null;

  const preview = text.trim().split('\n')[0].slice(0, 120);

  return (
    <div className="my-2 rounded-lg border border-outline-variant/60 bg-surface-container-low overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-container transition-colors"
      >
        <span className="material-symbols-outlined text-[16px] text-secondary">lightbulb</span>
        <span className="font-ui-label-bold text-[12px] text-on-surface/80">Suy nghĩ</span>
        <span className="flex-1 truncate font-ui-body text-[11px] text-on-surface-variant/60 ml-1">{preview}</span>
        <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-2 border-t border-outline-variant/40">
          <div className="text-[12px] leading-5 text-on-surface-variant whitespace-pre-wrap font-ui-body pt-2">{text}</div>
        </div>
      )}
    </div>
  );
}
