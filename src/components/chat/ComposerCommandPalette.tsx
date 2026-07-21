import { useEffect, useRef } from 'react';
import type { ComposerCommand } from '../../application/services/composerCommands';

interface ComposerCommandPaletteProps {
  commands: ComposerCommand[];
  selectedIndex: number;
  onSelect: (command: ComposerCommand) => void;
}

export function ComposerCommandPalette({ commands, selectedIndex, onSelect }: ComposerCommandPaletteProps) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Cuộn item được chọn vào viewport khi dùng phím mũi tên
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!commands.length) return null;
  return (
    <div className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-xl" role="listbox" aria-label="Lệnh nhanh">
      <p className="border-b border-outline-variant/60 px-3 py-2 text-[10px] font-ui-label-bold uppercase tracking-wide text-on-surface-variant">Lệnh nhanh</p>
      <div className="max-h-72 overflow-y-auto p-1">
        {commands.map((command, index) => (
          <button
            key={command.name}
            ref={index === selectedIndex ? selectedRef : undefined}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(command)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${index === selectedIndex ? 'bg-secondary/10 text-primary' : 'text-on-surface hover:bg-surface-container'}`}
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">{command.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-code-base text-[12px]">/{command.name}</span>
              <span className="block truncate text-[11px] text-on-surface-variant">{command.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
