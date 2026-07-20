import type { AgentControlViewModel } from '../../application/hooks/useAgentControlSnapshot';
import { AgentInspector } from '../chat/AgentInspector';

export function AgentDetailDockView(props: { agentId?: string; control: AgentControlViewModel }) {
  const participant = props.control.snapshot.participants.find((item) => item.id === props.agentId);
  if (!participant) {
    return <div className="flex flex-1 flex-col items-center justify-center px-8 text-center text-on-surface-variant"><span className="material-symbols-outlined text-[28px]">person_off</span><p className="mt-3 text-[12px]">Agent này không còn trong tác vụ hiện tại.</p></div>;
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-surface">
      <AgentInspector participant={participant} onStop={(id) => void props.control.stop(id)} onApprove={props.control.approve} />
    </div>
  );
}
