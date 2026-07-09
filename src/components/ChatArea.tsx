import { useEffect, useRef } from 'react';
import { useAppStore, type Message } from '../store/useAppStore';

// ─── Message bubble renderers ─────────────────────────────────────────────────

function UserMessage({ msg }: { msg: Message }) {
  return (
    <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/50 relative">
      <div className="absolute -left-3 top-6 w-6 h-6 rounded-full bg-primary-container text-on-primary flex items-center justify-center border-2 border-background z-10">
        <span className="material-symbols-outlined text-[14px]">person</span>
      </div>
      <p className="font-ui-body text-ui-body text-on-surface leading-relaxed text-[15px] whitespace-pre-wrap">
        {msg.content}
      </p>
      <span className="text-[11px] text-on-surface-variant/50 mt-2 block">
        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

function AgentMessage({ msg }: { msg: Message }) {
  return (
    <div className="pl-8 border-l border-outline-variant relative py-2">
      <div className="absolute -left-[17px] top-4 w-8 h-8 rounded-full bg-surface border border-outline-variant flex items-center justify-center text-secondary bg-surface-bright shadow-sm">
        <span className="material-symbols-outlined text-[18px]">smart_toy</span>
      </div>
      <div className="prose prose-stone max-w-none">
        <p className="font-ui-body text-ui-body text-on-surface-variant leading-relaxed text-[15px] whitespace-pre-wrap">
          {msg.content}
        </p>
        <span className="text-[11px] text-on-surface-variant/50 mt-2 block">
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="pl-8 border-l border-outline-variant relative py-2">
      <div className="absolute -left-[17px] top-4 w-8 h-8 rounded-full bg-surface border border-outline-variant flex items-center justify-center text-secondary bg-surface-bright shadow-sm">
        <span className="material-symbols-outlined text-[18px]">smart_toy</span>
      </div>
      <div className="flex items-center gap-3 text-secondary font-medium py-2">
        <div className="relative flex h-4 w-4 items-center justify-center">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-20"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
        </div>
        <span className="font-ui-body text-[14px] text-on-surface-variant">AI đang suy nghĩ...</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-24 gap-4">
      <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center mb-2">
        <span className="material-symbols-outlined text-[32px] text-on-primary-container">smart_toy</span>
      </div>
      <h3 className="font-display-serif text-summary-title text-primary">Sẵn sàng làm việc</h3>
      <p className="font-ui-body text-ui-body text-on-surface-variant max-w-sm">
        Hãy mô tả những gì bạn muốn xây dựng, giải thích hoặc refactor. Trợ lý AI sẽ bắt đầu làm việc.
      </p>
    </div>
  );
}

// ─── Main ChatArea ─────────────────────────────────────────────────────────────

export function ChatArea() {
  const messages = useAppStore((s) => s.messages);
  const activeTask = useAppStore((s) => s.activeTask);
  const isAgentTyping = useAppStore((s) => s.isAgentTyping);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message or typing indicator
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAgentTyping]);

  return (
    <div className="flex-1 overflow-y-auto pb-32">
      <div className="max-w-[900px] mx-auto w-full px-6 pt-8 flex flex-col gap-8">

        {/* Task Context Header */}
        {activeTask && (
          <div className="border-b border-outline-variant pb-6 mb-2">
            <div className="flex items-center gap-2 text-secondary mb-2">
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                bolt
              </span>
              <span className="font-ui-label-caps text-ui-label-caps uppercase tracking-wider">Tác vụ hiện tại</span>
            </div>
            <h2 className="font-display-serif text-[32px] leading-tight text-primary">{activeTask}</h2>
          </div>
        )}

        {/* Messages or Empty State */}
        {messages.length === 0 && !isAgentTyping ? (
          <EmptyState />
        ) : (
          <>
            {messages.map((msg) =>
              msg.sender === 'user' ? (
                <UserMessage key={msg.id} msg={msg} />
              ) : (
                <AgentMessage key={msg.id} msg={msg} />
              )
            )}
            {isAgentTyping && <TypingIndicator />}
          </>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}