import type { AgentTeamView } from '../../domain/entities/agentTeam';

const KIND_LABEL: Record<AgentTeamView['recentMessages'][number]['kind'], string> = {
  message: 'Tin nhắn', task_assignment: 'Giao việc', shutdown_request: 'Yêu cầu dừng',
  shutdown_response: 'Phản hồi dừng', plan_approval_response: 'Duyệt kế hoạch',
};

export function TeamMessageTimeline({ messages }: { messages: AgentTeamView['recentMessages'] }) {
  if (!messages.length) return null;
  return (
    <div className="mt-3 border-t border-outline-variant/50 pt-2" aria-label="Trao đổi giữa các agent">
      <p className="mb-1.5 text-[10px] font-ui-label-bold uppercase tracking-wide text-on-surface-variant">Trao đổi gần đây</p>
      <div className="space-y-1.5">
        {messages.slice(-5).reverse().map((message) => (
          <div key={message.id} className="flex items-start gap-2 text-[10px] text-on-surface-variant">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary/70" />
            <div className="min-w-0 flex-1">
              <p className="truncate"><span className="font-ui-label-bold text-primary">{message.from}</span> → {message.to}</p>
              <p className="truncate">{KIND_LABEL[message.kind]}{message.summary ? ` · ${message.summary}` : ''}</p>
            </div>
            <time className="shrink-0 opacity-70" dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
}
