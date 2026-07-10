import { useState } from 'react';
import type { AgentAction } from '../../domain/entities/message';

export function ToolStep({ action }: { action: AgentAction }) {
  const [isOpen, setIsOpen] = useState(false);
  const ok = action.status === 'ok';
  const running = action.status === 'running';

  return (
    <div className="my-2 rounded-lg border border-outline-variant/60 bg-surface-container-low overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-container transition-colors"
      >
        <span className={`material-symbols-outlined text-[16px] ${running ? 'text-secondary animate-spin' : ok ? 'text-[#27642a]' : 'text-error'}`}>
          {running ? 'settings' : ok ? 'check_circle' : 'error'}
        </span>
        <span className="font-ui-label-bold text-[12px] text-on-surface/80">
          {running ? 'Đang chạy' : ok ? 'Hoàn tất' : 'Lỗi'}:
        </span>
        <span className="font-code-base text-[12px] text-primary">{action.toolName}</span>
        {action.args && <span className="flex-1 truncate font-code-base text-[10px] text-on-surface-variant/50 ml-1">{action.args}</span>}
        <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-2 border-t border-outline-variant/40">
          {action.output ? (
            <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap font-code-base text-[11px] leading-5 text-on-surface-variant pt-2">{action.output}</pre>
          ) : (
            <div className="text-[12px] text-on-surface-variant/70 pt-2">Đang chờ output...</div>
          )}
        </div>
      )}
    </div>
  );
}
