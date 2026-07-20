import { useId, useState } from 'react';
import { summarizeToolProgress, toolActionHint, toolActionLabel } from '../../application/services/agentMessagePresentation';
import { useToolApproval } from '../../application/hooks/useToolApproval';
import type { AgentAction } from '../../domain/entities/message';

const STATUS_LABELS: Record<AgentAction['status'], string> = {
  awaiting_approval: 'Cần bạn', denied: 'Đã từ chối', running: 'Đang chạy', ok: 'Xong', error: 'Lỗi',
};

type ToolProgressGroupProps = {
  actions: AgentAction[];
  onRetry?: () => void;
};

export function ToolProgressGroup({ actions, onRetry }: ToolProgressGroupProps) {
  const summary = summarizeToolProgress(actions);
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const detailsId = useId();
  const open = openOverride ?? summary.autoOpen;
  const respondToApproval = useToolApproval();
  const toggle = () => setOpenOverride(!open);

  if (summary.tone === 'approval' || summary.tone === 'error') {
    return (
      <AttentionToolProgress
        actions={actions} detailsId={detailsId} open={open} summary={summary}
        onApproval={respondToApproval} onRetry={onRetry} onToggle={toggle}
      />
    );
  }

  return (
    <section className="my-1" aria-label={summary.title}>
      <button
        type="button" aria-expanded={open} aria-controls={detailsId} onClick={toggle}
        className="group flex min-h-8 w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-on-surface-variant transition-colors hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <ToolStatusIndicator tone={summary.tone} />
        <span className="shrink-0 text-[12px] font-medium text-on-surface" role="status" aria-live="polite" aria-atomic="true">{summary.title}</span>
      </button>
      {open && (
        <div id={detailsId} className="mt-0.5">
          <ToolDetailsList actions={actions} onApproval={respondToApproval} />
        </div>
      )}
    </section>
  );
}

function AttentionToolProgress(props: {
  actions: AgentAction[];
  detailsId: string;
  open: boolean;
  summary: ReturnType<typeof summarizeToolProgress>;
  onApproval: ReturnType<typeof useToolApproval>;
  onRetry?: () => void;
  onToggle: () => void;
}) {
  const isError = props.summary.tone === 'error';
  const retryable = props.actions.some((action) => action.status === 'error') && props.onRetry;
  return (
    <section className={`my-2 overflow-hidden rounded-xl border ${isError ? 'border-error/30 bg-error-container/25' : 'border-[#ed6c02]/35 bg-[#ed6c02]/5'}`} aria-label={props.summary.title}>
      <button
        type="button" aria-expanded={props.open} aria-controls={props.detailsId} onClick={props.onToggle}
        className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-secondary"
      >
        <span className={`material-symbols-outlined text-[18px] ${isError ? 'text-error' : 'text-[#a64600]'}`} aria-hidden="true">{props.summary.icon}</span>
        <span className="shrink-0 text-[12px] font-ui-label-bold text-on-surface" role="status" aria-live="polite" aria-atomic="true">{props.summary.title}</span>
        {props.summary.preview && <span className="min-w-0 flex-1 truncate text-[12px] text-on-surface-variant" title={props.summary.preview}>{props.summary.preview}</span>}
        <span className="material-symbols-outlined ml-auto text-[16px] text-on-surface-variant" aria-hidden="true">{props.open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {props.open && <div id={props.detailsId} className="border-t border-outline-variant/50"><ToolDetailsList actions={props.actions} onApproval={props.onApproval} /></div>}
      {retryable && (
        <div className="flex justify-end border-t border-error/15 px-3 py-2">
          <button type="button" onClick={props.onRetry} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-error px-3 py-1.5 text-[12px] font-ui-label-bold text-on-error hover:bg-error/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-error">
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">refresh</span>Thử lại
          </button>
        </div>
      )}
    </section>
  );
}

function ToolDetailsList(props: {
  actions: AgentAction[];
  onApproval: ReturnType<typeof useToolApproval>;
}) {
  return <ol className="max-h-[360px] overflow-y-auto px-2 py-1.5">{props.actions.map((action) => <ToolProgressItem key={action.id} action={action} onApproval={props.onApproval} />)}</ol>;
}

function ToolProgressItem(props: {
  action: AgentAction;
  onApproval: ReturnType<typeof useToolApproval>;
}) {
  const { action } = props;
  const hint = toolActionHint(action);
  const technicalDetails = formatTechnicalDetails(action);
  const [expanded, setExpanded] = useState(false);
  const hasTechnicalDetails = Boolean(technicalDetails);

  return (
    <li className="border-b border-outline-variant/30 last:border-0">
      <button
        type="button"
        disabled={!hasTechnicalDetails}
        onClick={() => hasTechnicalDetails && setExpanded((v) => !v)}
        className={`flex min-h-7 w-full items-center gap-2 px-1.5 py-2 text-left ${
          hasTechnicalDetails ? 'cursor-pointer hover:bg-surface-container-low/60 rounded-md' : 'cursor-default'
        }`}
      >
        <ActionStatusDot status={action.status} />
        <span className="shrink-0 text-[12px] font-medium text-on-surface">{toolActionLabel(action)}</span>
        {hint && <span className="min-w-0 flex-1 truncate text-[12px] text-on-surface-variant" title={hint}>{hint}</span>}
        <span className="ml-auto shrink-0 text-[11px] text-on-surface-variant">{STATUS_LABELS[action.status]}</span>
      </button>
      {action.status === 'error' && <p className="mt-1 px-1.5 pb-2 text-[12px] text-error">Không thể hoàn tất bước này.</p>}
      {action.status === 'denied' && <p className="mt-1 px-1.5 pb-2 text-[12px] text-on-surface-variant">Bạn đã từ chối bước này.</p>}
      {expanded && technicalDetails && (
        <pre className="mx-1.5 mb-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-surface-container px-3 py-2 font-code-base text-[11px] leading-5 text-on-surface-variant">{technicalDetails}</pre>
      )}
      {action.status === 'awaiting_approval' && (
        <div className="mb-2 flex flex-wrap items-center gap-2 px-1.5">
          <button type="button" onClick={() => props.onApproval(action, true)} className="min-h-8 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-on-primary">Cho phép</button>
          {isWebFetch(action) && <button type="button" onClick={() => props.onApproval(action, true, true)} className="min-h-8 rounded-lg border border-primary/30 px-3 py-1.5 text-[12px] text-primary">Luôn cho phép miền</button>}
          <button type="button" onClick={() => props.onApproval(action, false)} className="min-h-8 rounded-lg border border-outline-variant px-3 py-1.5 text-[12px] text-primary">Từ chối</button>
        </div>
      )}
    </li>
  );
}

function ToolStatusIndicator({ tone }: { tone: 'working' | 'success' }) {
  if (tone === 'working') return <span className="tool-status-pulse h-2 w-2 shrink-0 rounded-full bg-secondary" aria-hidden="true" />;
  return <span className="material-symbols-outlined shrink-0 text-[18px] text-[#2e7d32]" aria-hidden="true">check_circle</span>;
}

function ActionStatusDot({ status }: { status: AgentAction['status'] }) {
  const className = status === 'ok' ? 'bg-[#388e3c]' : status === 'running' ? 'tool-status-pulse bg-secondary' : status === 'awaiting_approval' ? 'bg-[#ed6c02]' : 'bg-error';
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${className}`} aria-hidden="true" />;
}

function formatTechnicalDetails(action: AgentAction) {
  const sections = [];
  if (action.args && action.args !== '{}') sections.push(`Yêu cầu\n${action.args}`);
  if (action.output) sections.push(`Kết quả\n${action.output}`);
  return sections.join('\n\n');
}

function isWebFetch(action: AgentAction) {
  return ['webfetch', 'web_fetch'].includes(action.toolName.toLowerCase().replaceAll('-', '_'));
}
