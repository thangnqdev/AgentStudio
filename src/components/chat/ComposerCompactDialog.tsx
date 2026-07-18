import { useState, type KeyboardEvent } from 'react';
import { useManualCompaction } from '../../application/hooks/useManualCompaction';

interface ComposerCompactDialogProps { onClose: () => void }

export function ComposerCompactDialog(props: ComposerCompactDialogProps) {
  const [instructions, setInstructions] = useState('');
  const { compact, busy, error } = useManualCompaction();
  const submit = async () => { if (await compact(instructions)) props.onClose(); };
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); props.onClose(); }
    else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); }
  };
  return (
    <div className="absolute inset-x-0 bottom-full z-20 mb-2 rounded-xl border border-outline-variant bg-surface p-4 shadow-xl">
      <div className="flex items-center justify-between"><div><p className="text-[10px] font-ui-label-bold uppercase tracking-wide text-on-surface-variant">Compact hội thoại</p><p className="mt-1 text-[11px] text-on-surface-variant">Thay lịch sử cũ bằng summary cục bộ; giữ nguyên các tin nhắn gần đây.</p></div><button type="button" onClick={props.onClose} className="px-2 text-xs text-on-surface-variant">Đóng</button></div>
      <textarea
        autoFocus value={instructions} maxLength={2_000} onChange={(event) => setInstructions(event.target.value)} onKeyDown={handleKeyDown}
        placeholder="Tùy chọn: điều cần ưu tiên giữ lại trong summary"
        className="mt-3 min-h-20 w-full resize-none rounded-lg bg-surface-container px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-secondary/50"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-[11px] text-error">{error}</span>
        <button type="button" disabled={busy} onClick={() => void submit()} className="settings-action disabled:opacity-40">{busy ? 'Đang compact…' : 'Compact'}</button>
      </div>
    </div>
  );
}
