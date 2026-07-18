import { useEffect, useState } from 'react';
import type { AgentTeamView } from '../../domain/entities/agentTeam';
import type { AgentControlSnapshot } from '../../application/services/agentControlCenter';
import { AgentControlHeader } from './AgentControlHeader';
import { AgentControlRoster } from './AgentControlRoster';
import { AgentCoordinationFeed } from './AgentCoordinationFeed';
import { AgentInspector } from './AgentInspector';
import { TeamMessageTimeline } from './TeamMessageTimeline';

type ControlTab = 'agents' | 'activity' | 'mailbox';

export function AgentControlSurface(props: {
  team: AgentTeamView | null;
  snapshot: AgentControlSnapshot;
  error?: string;
  onStop: (workerId: string) => void;
  onApprove: (workerId: string, actionId: string, approved: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [tab, setTab] = useState<ControlTab>('agents');
  const [selectedId, setSelectedId] = useState<string>();
  const selected = props.snapshot.participants.find((item) => item.id === selectedId)
    ?? props.snapshot.participants.find((item) => item.pendingAction)
    ?? props.snapshot.participants.find((item) => item.status === 'active')
    ?? props.snapshot.participants[0];

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const selectFromFeed = (id: string) => { setSelectedId(id); setTab('agents'); };
  return (
    <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm" aria-label="Agent control center">
      <AgentControlHeader name={props.team?.name} description={props.team?.description} pendingShutdowns={props.team?.pendingShutdowns} metrics={props.snapshot.metrics} expanded={expanded} onToggle={() => setExpanded((value) => !value)} />
      {expanded && (
        <div className="border-t border-outline-variant/60">
          <nav className="flex items-center gap-1 border-b border-outline-variant/60 bg-surface-container-low px-3 py-1.5" aria-label="Agent control views">
            <Tab active={tab === 'agents'} label="Agents" count={props.snapshot.metrics.total} onClick={() => setTab('agents')} />
            <Tab active={tab === 'activity'} label="Hoạt động" count={props.snapshot.activity.length} onClick={() => setTab('activity')} />
            <Tab active={tab === 'mailbox'} label="Mailbox" count={props.team?.recentMessages.length ?? 0} onClick={() => setTab('mailbox')} />
            <span className="ml-auto flex items-center gap-1 text-[9px] uppercase tracking-wide text-on-surface-variant"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#388e3c]" />Theo dõi trực tiếp</span>
          </nav>
          {props.error && <p className="border-b border-error/20 bg-error/5 px-4 py-2 text-[11px] text-error">{props.error}</p>}
          {tab === 'agents' && selected && <div className="grid min-h-64 md:grid-cols-[220px_minmax(0,1fr)]"><div className="border-b border-outline-variant/60 md:border-b-0 md:border-r"><AgentControlRoster participants={props.snapshot.participants} selectedId={selected.id} onSelect={setSelectedId} /></div><AgentInspector participant={selected} onStop={props.onStop} onApprove={props.onApprove} /></div>}
          {tab === 'activity' && <AgentCoordinationFeed activity={props.snapshot.activity} onSelect={selectFromFeed} />}
          {tab === 'mailbox' && (props.team?.recentMessages.length ? <div className="px-4 pb-4"><TeamMessageTimeline messages={props.team.recentMessages} /></div> : <p className="px-4 py-10 text-center text-[11px] text-on-surface-variant">Mailbox chưa có tin nhắn.</p>)}
        </div>
      )}
    </section>
  );
}

function Tab(props: { active: boolean; label: string; count: number; onClick: () => void }) {
  return <button type="button" onClick={props.onClick} className={`rounded-md px-2.5 py-1.5 text-[10px] font-ui-label-bold ${props.active ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface/70'}`}>{props.label}<span className="ml-1.5 opacity-60">{props.count}</span></button>;
}
