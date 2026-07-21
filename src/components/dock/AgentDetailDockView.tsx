import type { AgentControlViewModel } from '../../application/hooks/useAgentControlSnapshot';
import { AgentInspector } from '../chat/AgentInspector';

export function AgentDetailDockView(props: { agentId?: string; control: AgentControlViewModel; onBack: () => void }) {
  const participant = props.control.snapshot.participants.find((item) => item.id === props.agentId);
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="flex h-8 shrink-0 items-center border-b border-outline-variant/60 bg-surface-container-low px-2">
        <button type="button" onClick={props.onBack} className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium text-on-surface-variant hover:bg-interactive-hover hover:text-on-surface" aria-label="Quay lại danh sách agent">
          <span className="material-symbols-outlined text-[15px]">arrow_back</span>
          Hoạt động
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {participant
          ? <AgentInspector participant={participant} onStop={(id) => void props.control.stop(id)} onApprove={props.control.approve} />
          : <div className="flex h-full flex-col items-center justify-center px-8 text-center text-on-surface-variant"><span className="material-symbols-outlined text-[28px]">person_off</span><p className="mt-3 text-[12px]">Agent này không còn trong tác vụ hiện tại.</p></div>}
      </div>
    </div>
  );
}
