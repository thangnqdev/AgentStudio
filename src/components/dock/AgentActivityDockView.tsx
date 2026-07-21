import { useState } from 'react';
import type { AgentControlViewModel } from '../../application/hooks/useAgentControlSnapshot';
import type { AgentControlParticipant } from '../../application/services/agentControlCenter';
import { agentActivitySummary } from '../../application/services/agentDisplay';
import { useAppStore } from '../../store/useAppStore';
import { AgentControlRoster } from '../chat/AgentControlRoster';
import { AgentCoordinationFeed } from '../chat/AgentCoordinationFeed';
import { TeamMessageTimeline } from '../chat/TeamMessageTimeline';

type ActivityTab = 'agents' | 'activity' | 'messages';

export function AgentActivityDockView(props: {
  control: AgentControlViewModel;
  onOpenAgent: (participant: AgentControlParticipant) => void;
}) {
  const [tab, setTab] = useState<ActivityTab>('agents');
  const { snapshot, team, error } = props.control;
  const leadWorking = useAppStore((state) => state.isAgentTyping);
  const summary = agentActivitySummary(snapshot.metrics, leadWorking);
  const openAgent = (participantId: string) => {
    const participant = snapshot.participants.find((item) => item.id === participantId);
    if (participant) props.onOpenAgent(participant);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <section className="border-b border-outline-variant/60 px-3 py-2.5" aria-label="Tổng quan hoạt động">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><h3 className="truncate text-[12px] font-semibold text-on-surface">{summary.title}</h3><p className="text-[9px] text-on-surface-variant">Cập nhật trực tiếp</p></div>
          <div className="flex shrink-0 items-center gap-1.5 text-[9px] text-on-surface-variant">
            <span className={`h-2 w-2 rounded-full ${summary.dotClass}`} />
            {summary.status}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <Metric value={snapshot.metrics.total} label="Agent" />
          <Metric value={snapshot.metrics.completed} label="Hoàn tất" />
          <Metric value={snapshot.metrics.attention} label="Cần bạn" attention={snapshot.metrics.attention > 0} />
        </div>
      </section>
      <nav className="flex h-8 shrink-0 items-stretch border-b border-outline-variant/60 bg-surface-container-low px-2" aria-label="Theo dõi agent">
        <Tab active={tab === 'agents'} label="Agent" onClick={() => setTab('agents')} />
        <Tab active={tab === 'activity'} label="Nhật ký" onClick={() => setTab('activity')} />
        <Tab active={tab === 'messages'} label="Trao đổi" onClick={() => setTab('messages')} />
      </nav>
      {error && <p className="border-b border-error/40 bg-error-container px-4 py-2 text-[11px] text-on-error-container">{error}</p>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'agents' && (snapshot.participants.length
          ? <AgentControlRoster participants={snapshot.participants} onSelect={openAgent} />
          : <EmptyState />)}
        {tab === 'activity' && <AgentCoordinationFeed activity={snapshot.activity} onSelect={openAgent} />}
        {tab === 'messages' && (team?.recentMessages.length
          ? <div className="px-4 pb-4"><TeamMessageTimeline messages={team.recentMessages} /></div>
          : <p className="px-5 py-12 text-center text-[11px] leading-5 text-on-surface-variant">Chưa có trao đổi giữa các agent.</p>)}
      </div>
    </div>
  );
}

function Metric({ value, label, attention = false }: { value: number; label: string; attention?: boolean }) {
  return <div className={`flex min-w-0 items-baseline gap-1 rounded-md border px-2 py-1.5 ${attention ? 'border-warning/40 bg-warning-container' : 'border-outline-variant/60 bg-surface-container-low'}`}><span className="text-[13px] font-semibold text-on-surface">{value}</span><span className="truncate text-[9px] text-on-surface-variant">{label}</span></div>;
}
function Tab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`relative px-2.5 text-[10px] font-medium ${active ? 'text-on-surface' : 'text-on-surface-variant hover:bg-surface/70 hover:text-on-surface'}`}>{label}{active && <span className="absolute inset-x-1 bottom-0 h-[2px] bg-primary" />}</button>;
}
function EmptyState() {
  return <div className="flex min-h-[180px] h-full items-center justify-center px-7 py-8 text-center"><div><span className="material-symbols-outlined flex h-9 w-9 mx-auto items-center justify-center rounded-lg bg-surface-container text-[21px] text-on-surface-variant">hub</span><p className="mt-3 text-[11px] font-medium text-on-surface">Chưa có agent phụ</p><p className="mt-1 max-w-[250px] text-[10px] leading-4 text-on-surface-variant">Tiến độ sẽ xuất hiện khi agent chính bắt đầu chia việc.</p></div></div>;
}
