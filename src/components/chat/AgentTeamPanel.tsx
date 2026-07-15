import { useAgentTeam } from '../../application/hooks/useAgentTeam';
import { useAppStore } from '../../store/useAppStore';

const STATUS = { active: 'Đang làm', idle: 'Sẵn sàng', failed: 'Lỗi', killed: 'Đã dừng' } as const;

export function AgentTeamPanel() {
  const scopeId = useAppStore((state) => state.activeThreadId);
  const { team, error } = useAgentTeam(scopeId);
  if (!team && !error) return null;

  return (
    <section className="rounded-xl border border-secondary/30 bg-secondary/5 p-3" aria-label="Agent team">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] font-ui-label-bold text-primary">
            <span className="material-symbols-outlined text-[18px] text-secondary">groups</span>
            <span className="truncate">{team?.name ?? 'Agent team'}</span>
            {team && <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] text-on-surface-variant">{team.members.length}</span>}
          </div>
          {team?.description && <p className="mt-1 text-[11px] text-on-surface-variant">{team.description}</p>}
        </div>
        {!!team?.pendingShutdowns && <span className="rounded bg-error/10 px-2 py-1 text-[10px] text-error">{team.pendingShutdowns} chờ tắt</span>}
      </div>
      {error && <p className="mt-2 text-[11px] text-error">{error}</p>}
      {team && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {team.members.map((member) => (
            <article key={member.agentId} className="flex items-center gap-2 rounded-lg border border-outline-variant/60 bg-surface px-3 py-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${member.status === 'active' ? 'animate-pulse bg-secondary' : member.status === 'idle' ? 'bg-[#388e3c]' : 'bg-error'}`} />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-ui-label-bold text-primary">{member.name}</p>
                <p className="truncate text-[10px] text-on-surface-variant">{member.agentType || 'general-purpose'} · {STATUS[member.status]}{member.completedSteps !== undefined ? ` · ${member.completedSteps} bước` : ''}</p>
              </div>
            </article>
          ))}
        </div>
      )}
      {!!team?.recentMessages.length && (
        <p className="mt-2 truncate text-[10px] text-on-surface-variant">
          Tin gần nhất: {team.recentMessages.at(-1)?.from} → {team.recentMessages.at(-1)?.to}: {team.recentMessages.at(-1)?.summary || team.recentMessages.at(-1)?.kind}
        </p>
      )}
    </section>
  );
}
