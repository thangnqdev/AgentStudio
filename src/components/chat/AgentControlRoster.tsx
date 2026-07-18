import type { AgentControlParticipant } from '../../application/services/agentControlCenter';
import { AgentStatusIndicator } from './AgentStatusIndicator';

const STATUS_LABEL = { active: 'Đang chạy', idle: 'Sẵn sàng', paused: 'Tạm dừng', completed: 'Hoàn tất', failed: 'Lỗi', killed: 'Đã dừng' } as const;

export function AgentControlRoster(props: {
  participants: AgentControlParticipant[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="max-h-[25rem] space-y-1 overflow-y-auto p-2" role="listbox" aria-label="Danh sách agent">
      {props.participants.map((participant) => {
        const currentAction = [...participant.actions].reverse().find((action) => action.status === 'running' || action.status === 'awaiting_approval');
        const selected = participant.id === props.selectedId;
        return (
          <button key={participant.id} type="button" role="option" aria-selected={selected} onClick={() => props.onSelect(participant.id)}
            className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${selected ? 'border-secondary/40 bg-secondary/10' : 'border-transparent hover:border-outline-variant/60 hover:bg-surface-container-low'}`}>
            <div className="flex items-center gap-2">
              <AgentStatusIndicator status={participant.status} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-ui-label-bold text-primary">{participant.name}</span>
              {participant.pendingAction && <span className="material-symbols-outlined text-[16px] text-[#ed6c02]" title="Chờ duyệt">approval_delegation</span>}
            </div>
            <p className="mt-1 truncate pl-4 text-[10px] text-on-surface-variant">{roleLabel(participant.role)} · {participant.agentType}</p>
            <p className={`mt-1 truncate pl-4 text-[10px] ${currentAction ? 'text-secondary' : 'text-on-surface-variant/70'}`}>
              {currentAction ? `${currentAction.status === 'awaiting_approval' ? 'Chờ duyệt' : 'Đang dùng'} ${currentAction.toolName}` : `${STATUS_LABEL[participant.status]}${participant.completedSteps !== undefined ? ` · ${participant.completedSteps} bước` : ''}`}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function roleLabel(role: AgentControlParticipant['role']) {
  return role === 'lead' ? 'Lead' : role === 'teammate' ? 'Teammate' : 'Subagent';
}
