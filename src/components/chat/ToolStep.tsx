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
    <div className="my-2 rounded-lg border border-outline-variant/60 bg-surface-container-low overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-container transition-colors"
      >
        <span className={`material-symbols-outlined text-[16px] ${running ? 'text-secondary animate-spin' : awaitingApproval ? 'text-secondary' : ok ? 'text-[#27642a]' : 'text-error'}`}>
          {running ? 'settings' : awaitingApproval ? 'approval' : ok ? 'check_circle' : 'error'}
        </span>
        <span className="font-ui-label-bold text-[12px] text-on-surface/80">
          {awaitingApproval ? 'Chờ duyệt' : running ? 'Đang chạy' : denied ? 'Đã từ chối' : ok ? 'Hoàn tất' : 'Lỗi'}:
        </span>
        <span className="font-code-base text-[12px] text-primary">{action.toolName}</span>
        <span className="rounded bg-surface-container-high px-1.5 py-0.5 font-code-base text-[9px] uppercase text-on-surface-variant">{action.risk}</span>
        {action.args && <span className="flex-1 truncate font-code-base text-[10px] text-on-surface-variant/50 ml-1">{action.args}</span>}
        <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {awaitingApproval && <div className="flex items-center gap-2 border-t border-outline-variant/40 px-3 py-2"><button onClick={() => respondToApproval(action, true)} className="rounded bg-secondary px-3 py-1.5 text-[11px] font-ui-label-bold text-on-secondary">Cho phép</button><button onClick={() => respondToApproval(action, false)} className="rounded border border-outline-variant px-3 py-1.5 text-[11px] font-ui-label-bold text-primary">Từ chối</button></div>}
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
