import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { normalizeThreadTitle } from '../../domain/entities/chatThread';

interface ComposerRenameDialogProps {
  currentTitle: string;
  onRename: (title: string) => void;
  onClose: () => void;
}

export function ComposerRenameDialog(props: ComposerRenameDialogProps) {
  const [title, setTitle] = useState(props.currentTitle);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const normalized = normalizeThreadTitle(title);

  useEffect(() => { inputRef.current?.select(); }, []);

  const submit = () => {
    if (!normalized) return;
    props.onRename(normalized);
    props.onClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); props.onClose(); }
    else if (event.key === 'Enter') { event.preventDefault(); submit(); }
  };

  return (
    <div className="absolute inset-x-0 bottom-full z-20 mb-2 rounded-xl border border-outline-variant bg-surface p-3 shadow-xl">
      <label className="block text-[10px] font-ui-label-bold uppercase tracking-wide text-on-surface-variant" htmlFor="composer-session-title">
        Đổi tên chat hiện tại
      </label>
      <div className="mt-2 flex gap-2">
        <input
          ref={inputRef}
          id="composer-session-title"
          value={title}
          maxLength={96}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 rounded-lg bg-surface-container px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-secondary/50"
        />
        <button type="button" disabled={!normalized} onClick={submit} className="settings-action disabled:opacity-40">Đổi tên</button>
        <button type="button" onClick={props.onClose} className="px-2 text-xs text-on-surface-variant">Hủy</button>
      </div>
    </div>
  );
}
