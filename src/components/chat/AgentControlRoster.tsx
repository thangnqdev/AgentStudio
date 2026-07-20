import { useState } from 'react';
import type { AgentControlParticipant } from '../../application/services/agentControlCenter';
import { partitionAgentRoster } from '../../application/services/agentRosterSections';
import { AgentStatusIndicator } from './AgentStatusIndicator';
import { agentRoleLabel, agentStatusLabel, toolActivityLabel } from '../../application/services/agentDisplay';

type AgentControlRosterProps = {
  participants: AgentControlParticipant[];
  selectedId?: string;
  onSelect: (id: string) => void;
};

export function AgentControlRoster(props: AgentControlRosterProps) {
  const [completedOpen, setCompletedOpen] = useState(true);
  const sections = partitionAgentRoster(props.participants);
  return (
    <div className="space-y-2 p-2" role="listbox" aria-label="Danh sách agent">
      <RosterSection title="Đang hoạt động" participants={sections.active} selectedId={props.selectedId} onSelect={props.onSelect} />
      <RosterSection title="Cần bạn kiểm tra" participants={sections.attention} selectedId={props.selectedId} onSelect={props.onSelect} attention />
      {sections.completed.length > 0 && (
        <section>
          <button type="button" onClick={() => setCompletedOpen((value) => !value)} className="flex w-full items-center gap-1.5 px-2 py-1 text-left text-[9px] font-semibold uppercase tracking-wide text-on-surface-variant/70" aria-expanded={completedOpen}>
            <span className="material-symbols-outlined text-[13px]">{completedOpen ? 'expand_more' : 'chevron_right'}</span>
            Đã hoàn thành <span className="font-normal">{sections.completed.length}</span>
          </button>
          {completedOpen && <div className="space-y-0.5"><RosterRows participants={sections.completed} selectedId={props.selectedId} onSelect={props.onSelect} /></div>}
        </section>
      )}
    </div>
  );
}

function RosterSection(props: RosterProps & { title: string; attention?: boolean }) {
  if (!props.participants.length) return null;
  return (
    <section>
      <p className={`px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${props.attention ? 'text-warning' : 'text-on-surface-variant/70'}`}>{props.title} <span className="font-normal">{props.participants.length}</span></p>
      <div className="space-y-0.5"><RosterRows participants={props.participants} selectedId={props.selectedId} onSelect={props.onSelect} /></div>
    </section>
  );
}

type RosterProps = Pick<AgentControlRosterProps, 'selectedId' | 'onSelect'> & { participants: AgentControlParticipant[] };

function RosterRows(props: RosterProps) {
  return <>{props.participants.map((participant) => <RosterRow key={participant.id} participant={participant} selected={participant.id === props.selectedId} onSelect={props.onSelect} />)}</>;
}

function RosterRow({ participant, selected, onSelect }: { participant: AgentControlParticipant; selected: boolean; onSelect: (id: string) => void }) {
  const currentAction = [...participant.actions].reverse().find((action) => action.status === 'running' || action.status === 'awaiting_approval');
  return (
    <button type="button" role="option" aria-selected={selected} onClick={() => onSelect(participant.id)} className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${selected ? 'border-secondary/35 bg-secondary/[0.07]' : 'border-transparent hover:border-outline-variant/60 hover:bg-surface-container-low'}`}>
      <div className="flex items-center gap-2"><AgentStatusIndicator status={participant.status} /><span className="min-w-0 flex-1 truncate text-[11px] font-ui-label-bold text-primary">{participant.name}</span>{participant.pendingAction && <span className="material-symbols-outlined text-[15px] text-warning" title="Chờ duyệt">approval_delegation</span>}</div>
      <p className="mt-0.5 truncate pl-4 text-[9px] text-on-surface-variant">{agentRoleLabel(participant.role)}{participant.description ? ` · ${participant.description}` : ''}</p>
      <p className={`mt-0.5 truncate pl-4 text-[9px] ${currentAction ? 'text-secondary' : 'text-on-surface-variant/70'}`}>{currentAction ? (currentAction.status === 'awaiting_approval' ? 'Đang chờ bạn cho phép' : toolActivityLabel(currentAction.toolName)) : `${agentStatusLabel(participant.status)}${participant.completedSteps !== undefined ? ` · ${participant.completedSteps} bước` : ''}`}</p>
    </button>
  );
}
