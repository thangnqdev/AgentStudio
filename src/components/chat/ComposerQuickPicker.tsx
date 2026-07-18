import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { filterQuickPickerItems } from '../../application/services/quickPickerSearch';

export interface ComposerQuickPickerItem {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
}

interface ComposerQuickPickerProps {
  title: string;
  items: ComposerQuickPickerItem[];
  selectedValue?: string | null;
  emptyMessage?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export function ComposerQuickPicker(props: ComposerQuickPickerProps) {
  const [query, setQuery] = useState('');
  const visibleItems = props.searchable ? filterQuickPickerItems(props.items, query) : props.items;
  const initialIndex = Math.max(0, visibleItems.findIndex((item) => item.value === props.selectedValue));
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (props.searchable) {
      searchRef.current?.focus();
      optionRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    } else optionRefs.current[selectedIndex]?.focus();
  }, [props.searchable, selectedIndex, visibleItems]);
  useEffect(() => setSelectedIndex(0), [query]);

  const move = (offset: number) => {
    if (visibleItems.length === 0) return;
    setSelectedIndex((current) => (current + offset + visibleItems.length) % visibleItems.length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      props.onClose();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setSelectedIndex(event.key === 'Home' ? 0 : visibleItems.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = visibleItems[selectedIndex];
      if (item) props.onSelect(item.value);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-xl" onKeyDown={handleKeyDown}>
      <div className="flex items-center justify-between border-b border-outline-variant/60 px-3 py-2">
        <p className="text-[10px] font-ui-label-bold uppercase tracking-wide text-on-surface-variant">{props.title}</p>
        <span className="text-[10px] text-on-surface-variant/60">Enter chọn · Esc đóng</span>
      </div>
      {props.searchable && (
        <div className="border-b border-outline-variant/60 p-2">
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={props.searchPlaceholder ?? 'Tìm kiếm…'}
            className="w-full rounded-lg bg-surface-container px-3 py-2 text-xs text-on-surface outline-none placeholder:text-on-surface-variant/60 focus:ring-1 focus:ring-secondary/50"
            aria-label={props.searchPlaceholder ?? 'Tìm kiếm'}
          />
        </div>
      )}
      <div className="max-h-72 overflow-y-auto p-1" role="listbox" aria-label={props.title}>
        {visibleItems.length === 0 && (
          <p className="px-3 py-4 text-center text-[11px] text-on-surface-variant">{props.emptyMessage ?? 'Không có lựa chọn.'}</p>
        )}
        {visibleItems.map((item, index) => (
          <button
            key={item.value}
            ref={(element) => { optionRefs.current[index] = element; }}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            onClick={() => props.onSelect(item.value)}
            className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left ${index === selectedIndex ? 'bg-secondary/10 text-primary' : 'text-on-surface hover:bg-surface-container'}`}
          >
            <span className="material-symbols-outlined mt-0.5 text-[17px] text-secondary">{item.value === props.selectedValue ? 'check_circle' : 'circle'}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-code-base text-[12px]">{item.label}</span>
              {item.description && <span className="block text-[11px] text-on-surface-variant">{item.description}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
