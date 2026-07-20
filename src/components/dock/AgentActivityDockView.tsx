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
      <div className="border-b border-outline-variant/60 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="text-[13px] font-semibold text-on-surface">{summary.title}</h3><p className="mt-0.5 text-[10px] text-on-surface-variant">Cập nhật theo thời gian thực</p></div>
          <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
            <span className={`h-2 w-2 rounded-full ${summary.dotClass}`} />
            {summary.status}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric value={snapshot.metrics.total} label="Agent" />
          <Metric value={snapshot.metrics.completed} label="Hoàn tất" />
          <Metric value={snapshot.metrics.attention} label="Cần bạn" attention={snapshot.metrics.attention > 0} />
        </div>
      </div>
      <nav className="flex shrink-0 gap-1 border-b border-outline-variant/60 bg-surface-container-low px-3 py-1.5" aria-label="Theo dõi agent">
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
  return <div className={`rounded-lg border px-2.5 py-2 ${attention ? 'border-warning/40 bg-warning-container' : 'border-outline-variant/60 bg-surface-container-low'}`}><p className="text-[15px] font-semibold text-on-surface">{value}</p><p className="text-[9px] text-on-surface-variant">{label}</p></div>;
}
function Tab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-md px-2.5 py-1.5 text-[10px] font-medium ${active ? 'bg-surface text-on-surface shadow-sm ring-1 ring-outline-variant/60' : 'text-on-surface-variant hover:bg-surface/80'}`}>{label}</button>;
}
function EmptyState() {
  return <div className="px-7 py-14 text-center"><span className="material-symbols-outlined text-[28px] text-on-surface-variant">hub</span><p className="mt-3 text-[12px] font-medium text-on-surface-variant">Chưa có agent phụ</p><p className="mt-1 text-[10px] leading-5 text-on-surface-variant">Khi agent chính chia việc, tiến độ sẽ tự xuất hiện ở đây.</p></div>;
}
