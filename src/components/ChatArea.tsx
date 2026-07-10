import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAgentChat } from '../application/hooks/useAgentChat';
import { UserMessage } from './chat/UserMessage';
import { AgentMessage } from './chat/AgentMessage';
import { TypingIndicator } from './chat/TypingIndicator';
import { ChatEmptyState } from './chat/ChatEmptyState';

export function ChatArea() {
  const messages = useAppStore((s) => s.messages);
  const activeTask = useAppStore((s) => s.activeTask);
  const agentActions = useAppStore((s) => s.agentActions);
  const agentThoughts = useAppStore((s) => s.agentThoughts);
  const isAgentTyping = useAppStore((s) => s.isAgentTyping);
  const resumableTask = useAppStore((s) => s.resumableTask);
  const { handleRegenerate, resumeAgentTask } = useAgentChat();

  const [isDragging, setIsDragging] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAgentTyping, agentActions, agentThoughts]);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length > 0) {
      window.dispatchEvent(new CustomEvent('agentstudio:add-files', { detail: files }));
    }
  };

  return (
    <div
      className="flex-1 overflow-y-auto pb-32 relative"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-4 z-20 rounded-xl border-2 border-dashed border-secondary bg-secondary/10 flex items-center justify-center pointer-events-none">
          <div className="rounded-lg bg-surface px-4 py-3 border border-outline-variant shadow-sm text-primary font-ui-label-bold">
            Thả file để thêm vào ngữ cảnh
          </div>
        </div>
      )}

      <div className="max-w-[900px] mx-auto w-full px-6 pt-8 flex flex-col gap-5">
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

        {resumableTask && !isAgentTyping && (
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant pb-4">
            <div className="min-w-0 text-[13px] text-on-surface-variant">
              <span className="font-ui-label-bold text-primary">Tác vụ đã checkpoint</span>
              <span className="ml-2">{resumableTask.completedSteps}/180 bước</span>
            </div>
            <button
              type="button"
              onClick={() => resumeAgentTask(resumableTask.id)}
              className="shrink-0 flex items-center gap-1.5 rounded bg-secondary px-3 py-1.5 text-[12px] font-ui-label-bold text-on-secondary"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              Tiếp tục
            </button>
          </div>
        )}

        {messages.length === 0 && !isAgentTyping ? (
          <ChatEmptyState />
        ) : (
          <>
            {messages.map((msg) =>
              msg.sender === 'user' ? (
                <UserMessage key={msg.id} msg={msg} onRegenerate={handleRegenerate} />
              ) : (
                <AgentMessage key={msg.id} msg={msg} />
              )
            )}
            {isAgentTyping && <TypingIndicator />}
          </>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
