import { useState } from 'react';
import type { AgentAction } from '../../domain/entities/message';
import { useToolApproval } from '../../application/hooks/useToolApproval';

export function ToolStep({ action }: { action: AgentAction }) {
  const [isOpen, setIsOpen] = useState(false);
  const ok = action.status === 'ok';
  const running = action.status === 'running';
  const awaitingApproval = action.status === 'awaiting_approval';
  const denied = action.status === 'denied';
  const respondToApproval = useToolApproval();

  return (
    <div className={`my-3 overflow-hidden rounded-xl bg-surface-container-low border ${running ? 'border-secondary/50 shadow-sm' : 'border-outline-variant/50'} hover:bg-surface-container transition-colors duration-200`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left"
      >
        <span className={`material-symbols-outlined text-[16px] ${running ? 'text-secondary animate-spin' : awaitingApproval ? 'text-secondary' : ok ? 'text-[#388e3c]' : 'text-error'}`}>
          {running ? 'settings' : awaitingApproval ? 'approval' : ok ? 'check_circle' : 'error'}
        </span>
        <span className="font-ui-label-bold text-[12px] text-on-surface/80 tracking-wide">
          {awaitingApproval ? 'Chờ duyệt' : running ? 'Đang chạy' : denied ? 'Đã từ chối' : ok ? 'Hoàn tất' : 'Lỗi'}:
        </span>
        <span className="font-code-base text-[12px] text-primary">{action.toolName}</span>
        <span className="rounded-md bg-surface-container-high px-1.5 py-0.5 font-code-base text-[10px] uppercase text-on-surface-variant/80 border border-outline-variant/40">{action.risk}</span>
        {action.args && <span className="flex-1 truncate font-code-base text-[11px] text-on-surface-variant/60 ml-1">{action.args}</span>}
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant/50">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {awaitingApproval && <div className="flex items-center gap-2.5 border-t border-outline-variant/50 px-4 py-2.5 bg-surface-container"><button onClick={() => respondToApproval(action, true)} className="rounded-lg bg-primary hover:bg-primary/90 transition-colors px-3.5 py-1.5 text-[12px] font-medium text-on-primary shadow-sm">Cho phép</button>{action.toolName === 'WebFetch' && <button onClick={() => respondToApproval(action, true, true)} className="rounded-lg border border-primary/40 px-3.5 py-1.5 text-[12px] font-medium text-primary">Luôn cho phép miền</button>}<button onClick={() => respondToApproval(action, false)} className="rounded-lg border border-outline-variant hover:bg-surface-container-high transition-colors px-3.5 py-1.5 text-[12px] font-medium text-primary">Từ chối</button></div>}
      {isOpen && (
        <div className="px-4 pb-3 border-t border-outline-variant/30 bg-surface-container/50">
          {action.output ? (
            <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap font-code-base text-[12px] leading-[1.6] text-on-surface-variant pt-3">{action.output}</pre>
          ) : (
             <div className="text-[13px] text-on-surface-variant/60 pt-3 italic">Đang chờ output...</div>
          )}
        </div>
      )}
    </div>
  );
}
