import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useAgentChat } from '../application/hooks/useAgentChat';
import { UserMessage } from './chat/UserMessage';
import { AgentMessage } from './chat/AgentMessage';
import { SystemMessage } from './chat/SystemMessage';
import { TypingIndicator } from './chat/TypingIndicator';
import { ChatEmptyState } from './chat/ChatEmptyState';
import { MessageErrorBoundary } from './chat/MessageErrorBoundary';
import { AgentInteractionPanel } from './chat/AgentInteractionPanel';
import { PlanModeBanner } from './chat/PlanModeBanner';
import { WorktreeBanner } from './chat/WorktreeBanner';
import { useWorktreeStateSync } from '../application/hooks/useWorktreeStateSync';

export function ChatArea() {
  useWorktreeStateSync();
  const messages = useAppStore((s) => s.messages);
  const agentActions = useAppStore((s) => s.agentActions);
  const agentThoughts = useAppStore((s) => s.agentThoughts);
  const isAgentTyping = useAppStore((s) => s.isAgentTyping);
  const resumableTask = useAppStore((s) => s.resumableTask);
  const pendingInteraction = useAppStore((s) => s.pendingInteraction);
  const { forkAgentTask, handleRegenerate, resumeAgentTask, retryAgentResponse } = useAgentChat();

  const [isDragging, setIsDragging] = useState(false);
  const [isForking, setIsForking] = useState(false);
  const [forkError, setForkError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAgentTyping, agentActions, agentThoughts, pendingInteraction]);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length > 0) {
      window.dispatchEvent(new CustomEvent('agentstudio:add-files', { detail: files }));
    }
  };

  const handleFork = async (taskId: string) => {
    setIsForking(true);
    setForkError('');
    try { await forkAgentTask(taskId); }
    catch (error) { setForkError(error instanceof Error ? error.message : 'Không thể tạo nhánh tác vụ.'); }
    finally { setIsForking(false); }
  };

  return (
    <div
      className="relative flex-1 overflow-y-auto pb-36"
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

      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-3 px-6 pt-6">
        {resumableTask && !isAgentTyping && (
          <div className="flex items-center justify-between gap-3 border-b border-outline-variant pb-4">
            <div className="min-w-0 text-[13px] text-on-surface-variant">
              <span className="font-ui-label-bold text-primary">Đã lưu tiến độ</span>
              <span className="ml-2">{resumableTask.completedSteps} bước đã hoàn tất</span>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <button type="button" disabled={isForking} onClick={() => void handleFork(resumableTask.id)} className="settings-action flex items-center gap-1.5 disabled:opacity-50">
                <span className="material-symbols-outlined text-[16px]">fork_right</span>
                {isForking ? 'Đang tạo…' : 'Thử một hướng khác'}
              </button>
              <button type="button" disabled={isForking} onClick={() => resumeAgentTask(resumableTask.id)} className="flex items-center gap-1.5 rounded bg-secondary px-3 py-1.5 text-[12px] font-ui-label-bold text-on-secondary disabled:opacity-50">
                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                Tiếp tục
              </button>
            </div>
          </div>
        )}

        {forkError && <p className="text-[12px] text-error">{forkError}</p>}

        <PlanModeBanner />
        <WorktreeBanner />

        {messages.length === 0 && !isAgentTyping ? (
          <ChatEmptyState />
        ) : (
          <>
            {messages.map((msg) =>
              msg.sender === 'user' ? (
                <MessageErrorBoundary key={msg.id}>
                  <UserMessage msg={msg} onRegenerate={handleRegenerate} />
                </MessageErrorBoundary>
              ) : msg.sender === 'agent' ? (
                <MessageErrorBoundary key={msg.id}>
                  <AgentMessage msg={msg} onRetry={() => void retryAgentResponse(msg.id)} />
                </MessageErrorBoundary>
              ) : (
                <MessageErrorBoundary key={msg.id}>
                  <SystemMessage msg={msg} />
                </MessageErrorBoundary>
              )
            )}
            <AgentInteractionPanel />
            {isAgentTyping && <TypingIndicator />}
          </>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
