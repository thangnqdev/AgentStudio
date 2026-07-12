import { useState } from 'react';

export function ThinkStep({ text }: { text: string }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!text.trim()) return null;

  const preview = text.trim().split('\n')[0].slice(0, 120);

  return (
    <div className="my-3 overflow-hidden rounded-xl bg-surface-container-low border border-outline-variant/50 hover:bg-surface-container transition-colors duration-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left"
      >
        <span className="material-symbols-outlined text-[16px] text-secondary/80">lightbulb</span>
        <span className="font-ui-label-bold text-[12px] text-on-surface/80 tracking-wide">Suy nghĩ</span>
        <span className="flex-1 truncate font-ui-body text-[12px] text-on-surface-variant/60 ml-1">{preview}</span>
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant/50">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isOpen && (
        <div className="px-4 pb-3 border-t border-outline-variant/30 bg-surface-container/50">
          <div className="text-[13px] leading-[1.6] text-on-surface-variant/80 whitespace-pre-wrap font-ui-body pt-3 italic">{text}</div>
        </div>
      )}
    </div>
  );
}
