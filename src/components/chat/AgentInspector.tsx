import type { AgentControlParticipant } from '../../application/services/agentControlCenter';
import { AgentStatusIndicator } from './AgentStatusIndicator';
import { WorkerActivityTimeline } from './WorkerActivityTimeline';

export function AgentInspector(props: {
  participant: AgentControlParticipant;
  onStop: (workerId: string) => void;
  onApprove: (workerId: string, actionId: string, approved: boolean) => void;
}) {
  const item = props.participant;
  return (
    <article className="min-w-0 p-4" aria-label={`Chi tiết agent ${item.name}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <AgentStatusIndicator status={item.status} chip />
            <h4 className="truncate text-[14px] font-ui-label-bold text-primary">{item.name}</h4>
            {item.background && <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] uppercase tracking-wide text-on-surface-variant">background</span>}
          </div>
          <p className="mt-1 text-[10px] text-on-surface-variant">{roleLabel(item.role)} · {item.agentType}{item.model ? ` · ${item.model}` : ''}</p>
        </div>
        {item.workerId && item.status === 'active' && <button type="button" onClick={() => props.onStop(item.workerId!)} className="settings-action shrink-0 px-2.5 py-1 text-[11px] text-error"><span className="material-symbols-outlined mr-1 align-middle text-[14px]">stop_circle</span>Dừng</button>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
        <Detail label="Quyền" value={item.permissionMode} />
        <Detail label="Bước" value={item.completedSteps === undefined ? '—' : String(item.completedSteps)} />
        <Detail label="Độ sâu" value={item.depth === undefined ? '—' : String(item.depth)} />
        <Detail label="Cập nhật" value={formatTime(item.updatedAt)} />
      </div>

      {item.description && <div className="mt-3 rounded-lg bg-surface-container-low px-3 py-2"><p className="text-[9px] font-ui-label-bold uppercase tracking-wide text-on-surface-variant">Nhiệm vụ</p><p className="mt-1 whitespace-pre-wrap text-[11px] text-primary">{item.description}</p></div>}

      {item.pendingAction && item.workerId && (
        <div className="mt-3 rounded-lg border border-[#ed6c02]/40 bg-[#ed6c02]/5 p-3 text-[11px]">
          <div className="flex items-center gap-2 font-ui-label-bold text-[#a64600]"><span className="material-symbols-outlined text-[17px]">approval_delegation</span>Agent đang chờ phê duyệt</div>
          <p className="mt-2 break-words font-code-base text-[10px] text-primary">{item.pendingAction.toolName}: {item.pendingAction.args}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => props.onApprove(item.workerId!, item.pendingAction!.id, true)} className="rounded bg-primary px-3 py-1.5 text-on-primary">Cho phép</button>
            <button type="button" onClick={() => props.onApprove(item.workerId!, item.pendingAction!.id, false)} className="rounded border border-outline-variant px-3 py-1.5 text-primary">Từ chối</button>
          </div>
        </div>
      )}

      <WorkerActivityTimeline actions={item.actions} />
      {(item.resultPreview || item.error) && <div className={`mt-3 max-h-36 overflow-y-auto whitespace-pre-wrap rounded-lg px-3 py-2 font-code-base text-[10px] ${item.error ? 'bg-error/5 text-error' : 'bg-surface-container-low text-on-surface-variant'}`}>{item.error || item.resultPreview}</div>}
      {item.worktreePath && <p className="mt-2 truncate font-code-base text-[10px] text-on-surface-variant" title={item.worktreePath}><span className="material-symbols-outlined mr-1 align-middle text-[14px]">account_tree</span>{item.worktreeBranch || 'worktree'} · {item.worktreePath}</p>}
      {!item.actions.length && !item.pendingAction && !item.resultPreview && !item.error && <p className="mt-4 rounded-lg border border-dashed border-outline-variant px-3 py-5 text-center text-[11px] text-on-surface-variant">Hoạt động mới của agent sẽ xuất hiện tại đây theo thời gian thực.</p>}
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-outline-variant/60 bg-surface px-2 py-1.5"><p className="text-[9px] uppercase tracking-wide text-on-surface-variant/70">{label}</p><p className="mt-0.5 truncate font-code-base text-[10px] text-primary" title={value}>{value}</p></div>; }
function roleLabel(role: AgentControlParticipant['role']) { return role === 'lead' ? 'Team lead' : role === 'teammate' ? 'Teammate' : 'Subagent'; }
function formatTime(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'; }
