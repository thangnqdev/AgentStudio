import type { Message } from '../../domain/entities/message';

export function SystemMessage({ msg }: { msg: Message }) {
  return (
    <div className="flex justify-center my-4 group">
      <div className="bg-surface-container border border-outline-variant/50 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-sm transition-all hover:bg-surface-container-high">
        <span className="material-symbols-outlined text-[15px] text-tertiary/70">compress</span>
        <span className="text-[12.5px] font-ui-label-bold text-on-surface-variant/80 tracking-wide">{msg.content}</span>
      </div>
    </div>
  );
}
