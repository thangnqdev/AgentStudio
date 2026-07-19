import type { AgentControlActivity } from '../../application/services/agentControlCenter';
import { toolActivityLabel } from '../../application/services/agentDisplay';

export function AgentCoordinationFeed(props: { activity: AgentControlActivity[]; onSelect: (participantId: string) => void }) {
  if (!props.activity.length) return <p className="px-4 py-10 text-center text-[11px] text-on-surface-variant">Chưa có hoạt động phối hợp.</p>;
  return (
    <div className="max-h-[28rem] divide-y divide-outline-variant/40 overflow-y-auto px-4" aria-label="Luồng hoạt động nhiều agent">
      {props.activity.map((event) => (
        <button key={event.id} type="button" disabled={!event.participantId} onClick={() => event.participantId && props.onSelect(event.participantId)} className="flex w-full items-start gap-3 py-3 text-left disabled:cursor-default">
          <span className={`material-symbols-outlined mt-0.5 text-[17px] ${event.kind === 'mailbox' ? 'text-[#5877a7]' : event.status === 'error' || event.status === 'denied' ? 'text-error' : event.status === 'awaiting_approval' ? 'text-[#ed6c02]' : 'text-secondary'}`}>{event.kind === 'mailbox' ? 'forward_to_inbox' : 'build_circle'}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="truncate text-[11px] font-ui-label-bold text-primary">{event.agentName}</span><span className="truncate text-[10px] text-on-surface-variant" title={event.title}>{event.kind === 'tool' ? toolActivityLabel(event.title) : event.title}</span></div>
            {event.detail && <p className="mt-1 line-clamp-2 text-[10px] text-on-surface-variant" title={event.detail}>{event.detail}</p>}
          </div>
          <time className="shrink-0 text-[9px] text-on-surface-variant/70" dateTime={event.createdAt}>{formatTime(event.createdAt)}</time>
        </button>
      ))}
    </div>
  );
}

function formatTime(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''; }
