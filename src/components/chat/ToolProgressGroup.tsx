import { useState } from 'react';
import { summarizeToolProgress, toolActionHint, toolActionLabel } from '../../application/services/agentMessagePresentation';
import { useToolApproval } from '../../application/hooks/useToolApproval';
import type { AgentAction } from '../../domain/entities/message';

const TONES = {
  working: 'text-secondary', approval: 'text-[#a64600]', success: 'text-[#2e7d32]', error: 'text-error',
} as const;
const STATUS_LABELS: Record<AgentAction['status'], string> = {
  awaiting_approval: 'Cần bạn', denied: 'Đã từ chối', running: 'Đang chạy', ok: 'Xong', error: 'Lỗi',
};

export function ToolProgressGroup({ actions }: { actions: AgentAction[] }) {
  const summary = summarizeToolProgress(actions);
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? summary.autoOpen;
  const respondToApproval = useToolApproval();
  return (
    <section className={`my-2 overflow-hidden rounded-lg border bg-surface-container-low/70 ${summary.tone === 'error' ? 'border-error/25' : summary.tone === 'approval' ? 'border-[#ed6c02]/30' : 'border-outline-variant/50'}`} aria-label={summary.title}>
      <button type="button" aria-expanded={open} onClick={() => setOpenOverride(!open)} className="flex min-h-9 w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-container">
        <span className={`material-symbols-outlined text-[16px] ${TONES[summary.tone]} ${summary.tone === 'working' ? 'animate-spin' : ''}`}>{summary.icon}</span>
        <span className="shrink-0 text-[11px] font-ui-label-bold text-on-surface">{summary.title}</span>
        <span className="min-w-0 flex-1 truncate text-[10px] text-on-surface-variant" title={summary.preview}>{summary.preview}</span>
        <span className="material-symbols-outlined text-[15px] text-on-surface-variant/60">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <ol className="max-h-[360px] overflow-y-auto border-t border-outline-variant/40 bg-white/60 px-2 py-1.5">
          {actions.map((action) => <ToolProgressItem key={action.id} action={action} onApproval={respondToApproval} />)}
        </ol>
      )}
    </section>
  );
}

function ToolProgressItem(props: {
  action: AgentAction;
  onApproval: (action: AgentAction, approved: boolean, rememberDomain?: boolean) => void;
}) {
  const { action } = props;
  const hint = toolActionHint(action);
  const hasDetails = Boolean(action.output || (action.args && action.args !== '{}'));
  return (
    <li className="border-b border-outline-variant/30 last:border-0">
      <details>
        <summary className={`flex min-h-8 list-none items-center gap-2 rounded px-1.5 py-1 hover:bg-surface-container-low ${hasDetails ? 'cursor-pointer' : 'cursor-default'}`}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${action.status === 'ok' ? 'bg-[#388e3c]' : action.status === 'running' ? 'animate-pulse bg-secondary' : action.status === 'awaiting_approval' ? 'bg-[#ed6c02]' : 'bg-error'}`} />
          <span className="shrink-0 text-[11px] font-medium text-primary">{toolActionLabel(action)}</span>
          {hint && <span className="min-w-0 flex-1 truncate text-[10px] text-on-surface-variant" title={hint}>{hint}</span>}
          <span className="ml-auto shrink-0 text-[9px] text-on-surface-variant/70">{STATUS_LABELS[action.status]}</span>
          {hasDetails && <span className="material-symbols-outlined text-[13px] text-on-surface-variant/50">expand_more</span>}
        </summary>
        {hasDetails && <pre className="mx-1.5 mb-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-surface-container px-2.5 py-2 font-code-base text-[10px] leading-4 text-on-surface-variant">{action.output || action.args}</pre>}
      </details>
      {action.status === 'awaiting_approval' && (
        <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
          <button type="button" onClick={() => props.onApproval(action, true)} className="rounded bg-primary px-2.5 py-1 text-[10px] font-medium text-on-primary">Cho phép</button>
          {action.toolName === 'WebFetch' && <button type="button" onClick={() => props.onApproval(action, true, true)} className="rounded border border-primary/30 px-2.5 py-1 text-[10px] text-primary">Luôn cho phép miền</button>}
          <button type="button" onClick={() => props.onApproval(action, false)} className="rounded border border-outline-variant px-2.5 py-1 text-[10px] text-primary">Từ chối</button>
        </div>
      )}
    </li>
  );
}
