import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useAppStore, type AgentAction, type Message } from '../store/useAppStore';

type AgentContentPart =
  | { type: 'text'; value: string }
  | { type: 'code'; language: string; value: string }
  | { type: 'think'; value: string }
  | { type: 'tool'; actionId: string };

function UserMessage({ msg, onRegenerate }: { msg: Message; onRegenerate: (message: Message, content: string) => void }) {
  const handleEdit = () => {
    const nextContent = window.prompt('Sửa tin nhắn và regenerate:', msg.content);
    if (nextContent === null) return;
    if (!nextContent.trim()) return;
    onRegenerate(msg, nextContent.trim());
  };

  return (
    <div className="group flex justify-end">
      <div className="relative max-w-[72%] rounded-2xl bg-[#171514] px-4 py-3 text-white shadow-sm">
        <button
          onClick={handleEdit}
          className="absolute -left-9 top-2 w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant opacity-0 group-hover:opacity-100 hover:bg-surface-container-high transition"
          title="Sửa và regenerate"
        >
          <span className="material-symbols-outlined text-[16px]">edit</span>
        </button>

        {msg.attachments && msg.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {msg.attachments.map(att => (
              <div key={att.id}>
                {att.type === 'image' ? (
                  <div className="relative rounded-lg overflow-hidden border border-white/10 w-32 h-32">
                    {att.previewUrl || att.data ? (
                      <img src={att.previewUrl || att.data} alt={att.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/10">
                        <span className="material-symbols-outlined text-[22px] text-white/70">image</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] truncate px-1.5 py-0.5" title={att.name}>
                      {att.name}
                    </div>
                  </div>
                ) : att.type === 'video' ? (
                  <div className="rounded-lg overflow-hidden border border-white/10 w-48 h-32 bg-black">
                    {att.previewUrl || att.data ? (
                      <video src={att.previewUrl || att.data} controls className="w-full h-full object-contain" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/70">
                        <span className="material-symbols-outlined text-[22px]">video_file</span>
                      </div>
                    )}
                  </div>
                ) : att.type === 'audio' ? (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-2 w-64">
                    {att.previewUrl || att.data ? (
                      <audio src={att.previewUrl || att.data} controls className="w-full h-8" />
                    ) : (
                      <div className="text-[12px] text-white/70 truncate">{att.name}</div>
                    )}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-code-base bg-white/10 text-white/80" title={att.name}>
                    <span className="material-symbols-outlined text-[15px]">description</span>
                    <span className="max-w-[160px] truncate">{att.name}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="font-ui-body text-[15px] leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </div>
        <span className="text-[10px] text-white/40 mt-1.5 block text-right">
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  const handleApply = async () => {
    const targetPath = window.prompt('Áp dụng code vào file nào? Nhập đường dẫn tương đối trong workspace:');
    if (!targetPath) return;

    try {
      setIsApplying(true);
      if (!window.agentStudio) throw new Error('Electron bridge is not available.');
      await window.agentStudio.writeWorkspaceFile({ path: targetPath, content: code });
      window.alert(`Đã áp dụng vào ${targetPath}`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Apply code thất bại.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-outline-variant bg-[#171717]">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/30 px-3 py-2">
        <span className="font-code-base text-[11px] text-white/60">{language || 'text'}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="h-7 px-2 rounded text-[11px] text-white/70 hover:bg-white/10"
            title="Copy code"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={handleApply}
            disabled={isApplying}
            className="h-7 px-2 rounded text-[11px] text-white/70 hover:bg-white/10 disabled:opacity-50"
            title="Apply code vào file"
          >
            Apply
          </button>
        </div>
      </div>
      <pre className="max-h-[420px] overflow-auto p-4 text-[12px] leading-5 text-[#f4f4f5] font-code-base">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ThinkStep({ text }: { text: string }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!text.trim()) return null;

  const preview = text.trim().split('\n')[0].slice(0, 120);

  return (
    <div className="my-2 rounded-lg border border-outline-variant/60 bg-surface-container-low overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-container transition-colors"
      >
        <span className="material-symbols-outlined text-[16px] text-secondary">lightbulb</span>
        <span className="font-ui-label-bold text-[12px] text-on-surface/80">Suy nghĩ</span>
        <span className="flex-1 truncate font-ui-body text-[11px] text-on-surface-variant/60 ml-1">{preview}</span>
        <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-2 border-t border-outline-variant/40">
          <div className="text-[12px] leading-5 text-on-surface-variant whitespace-pre-wrap font-ui-body pt-2">{text}</div>
        </div>
      )}
    </div>
  );
}

function ToolStep({ action }: { action: AgentAction }) {
  const [isOpen, setIsOpen] = useState(false);
  const ok = action.status === 'ok';
  const running = action.status === 'running';

  return (
    <div className="my-2 rounded-lg border border-outline-variant/60 bg-surface-container-low overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-container transition-colors"
      >
        <span className={`material-symbols-outlined text-[16px] ${running ? 'text-secondary animate-spin' : ok ? 'text-[#27642a]' : 'text-error'}`}>
          {running ? 'settings' : ok ? 'check_circle' : 'error'}
        </span>
        <span className="font-ui-label-bold text-[12px] text-on-surface/80">
          {running ? 'Đang chạy' : ok ? 'Hoàn tất' : 'Lỗi'}:
        </span>
        <span className="font-code-base text-[12px] text-primary">{action.toolName}</span>
        {action.args && <span className="flex-1 truncate font-code-base text-[10px] text-on-surface-variant/50 ml-1">{action.args}</span>}
        <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-2 border-t border-outline-variant/40">
          {action.output ? (
            <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap font-code-base text-[11px] leading-5 text-on-surface-variant pt-2">{action.output}</pre>
          ) : (
            <div className="text-[12px] text-on-surface-variant/70 pt-2">Đang chờ output...</div>
          )}
        </div>
      )}
    </div>
  );
}

function AgentMessage({ msg }: { msg: Message }) {
  const activeActions = useAppStore((s) => s.agentActions);
  
  if (!msg.content && msg.status === 'sending') return null;

  const parts = parseAgentContent(msg.content);
  const actionsToDisplay = msg.status === 'sending' ? activeActions : (msg.actions || []);
  const actionsMap = new Map(actionsToDisplay.map(a => [a.id, a]));

  return (
    <div className="grid grid-cols-[28px_1fr] gap-3 py-1">
      <div className="relative flex justify-center">
        <div className="absolute top-7 bottom-0 w-px bg-outline-variant" />
        <div className="relative z-10 mt-1 w-5 h-5 rounded-full bg-background border border-outline-variant flex items-center justify-center text-secondary">
          <span className="material-symbols-outlined text-[14px]">smart_toy</span>
        </div>
      </div>
      <div className="min-w-0 max-w-none pt-0.5">
        {parts.map((part, index) => {
          if (part.type === 'think') return <ThinkStep key={`think-${index}`} text={part.value} />;
          if (part.type === 'tool') {
            const action = actionsMap.get(part.actionId);
            return action ? <ToolStep key={`tool-${index}`} action={action} /> : null;
          }
          if (part.type === 'code') return <CodeBlock key={`code-${index}`} language={part.language} code={part.value} />;
          return <TextBlock key={`text-${index}`} text={part.value} />;
        })}
        <span className="text-[11px] text-on-surface-variant/50 mt-2 block">
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

function stripLegacyActionLogs(text: string) {
  const lines = text.split('\n');
  let textBuffer: string[] = [];
  const visible: string[] = [];

  const flushText = () => {
    if (textBuffer.length === 0) return;
    const value = textBuffer.join('\n');
    if (value) visible.push(value);
    textBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const toolMatch = line.match(/^\[tool:([^\]]+)\]\s*(.*)$/);
    if (!toolMatch) {
      textBuffer.push(line);
      continue;
    }

    flushText();

    let cursor = index + 1;
    while (cursor < lines.length) {
      const nextLine = lines[cursor];
      if (/^\[tool:([^\]]+)\]/.test(nextLine)) break;
      cursor += 1;
    }
    index = cursor - 1;
  }

  flushText();
  return visible.join('\n').trim();
}

function TextBlock({ text }: { text: string }) {
  const visibleText = stripLegacyActionLogs(text);
  if (!visibleText) return null;

  return (
    <div className="font-ui-body text-ui-body text-on-surface-variant leading-relaxed text-[15px] whitespace-pre-wrap">
      {visibleText}
    </div>
  );
}



function parseTextAndCode(content: string): AgentContentPart[] {
  const parts: AgentContentPart[] = [];
  const codeFenceRegex = /```([\w.+-]*)\n([\s\S]*?)(?:```|$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeFenceRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    parts.push({
      type: 'code',
      language: match[1] || 'text',
      value: match[2],
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) });
  }
  return parts;
}

function parseAgentContent(content: string): AgentContentPart[] {
  const parts: AgentContentPart[] = [];
  const pattern = /(?:<(?:think|thinking)>([\s\S]*?)(?:<\/(?:think|thinking)>|$))|(?:\[tool:([^\]]+)\])/gi;
  
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(...parseTextAndCode(content.slice(lastIndex, match.index)));
    }
    
    if (match[1] !== undefined) {
      parts.push({ type: 'think', value: match[1] });
    } else if (match[2] !== undefined) {
      parts.push({ type: 'tool', actionId: match[2] });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < content.length) {
    parts.push(...parseTextAndCode(content.slice(lastIndex)));
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: content }];
}




function TypingIndicator() {
  return (
    <div className="grid grid-cols-[28px_1fr] gap-3 py-1">
      <div className="relative flex justify-center">
        <div className="absolute top-7 bottom-0 w-px bg-outline-variant" />
        <div className="relative z-10 mt-1 w-5 h-5 rounded-full bg-background border border-outline-variant flex items-center justify-center text-secondary">
          <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-secondary font-medium pt-1.5">
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
        Hãy mô tả những gì bạn muốn xây dựng, giải thích hoặc refactor. Kéo thả file vào đây để thêm ngữ cảnh.
      </p>
    </div>
  );
}

export function ChatArea() {
  const messages = useAppStore((s) => s.messages);
  const activeTask = useAppStore((s) => s.activeTask);
  const agentActions = useAppStore((s) => s.agentActions);
  const agentThoughts = useAppStore((s) => s.agentThoughts);
  const isAgentTyping = useAppStore((s) => s.isAgentTyping);
  const addMessage = useAppStore((s) => s.addMessage);
  const updateMessage = useAppStore((s) => s.updateMessage);
  const appendMessageContent = useAppStore((s) => s.appendMessageContent);
  const setIsAgentTyping = useAppStore((s) => s.setIsAgentTyping);
  const setActiveRequestId = useAppStore((s) => s.setActiveRequestId);
  const upsertAgentAction = useAppStore((s) => s.upsertAgentAction);
  const clearAgentActions = useAppStore((s) => s.clearAgentActions);
  const appendAgentThoughtChunk = useAppStore((s) => s.appendAgentThoughtChunk);
  const clearAgentThoughts = useAppStore((s) => s.clearAgentThoughts);
  const replaceUserMessageAndTrim = useAppStore((s) => s.replaceUserMessageAndTrim);

  const [isDragging, setIsDragging] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAgentTyping, agentActions, agentThoughts]);

  const startAgentResponse = async (messagesToSend: Message[]) => {
    clearAgentActions();
    clearAgentThoughts();
    setIsAgentTyping(true);
    const agentMsgId = addMessage({ sender: 'agent', content: '', type: 'text', status: 'sending' });
    let hasStartedResponse = false;

    try {
      const { streamChatCompletion } = await import('../services/ai');
      await streamChatCompletion(
        messagesToSend,
        (chunk) => {
          if (!hasStartedResponse) {
            hasStartedResponse = true;
          }
          setIsAgentTyping(false);
          appendMessageContent(agentMsgId, chunk);
        },
        () => {
          const finalActions = useAppStore.getState().agentActions;
          updateMessage(agentMsgId, { status: 'done', actions: finalActions });
          setIsAgentTyping(false);
          setActiveRequestId(null);
          clearAgentActions();
          clearAgentThoughts();
        },
        (error) => {
          const finalActions = useAppStore.getState().agentActions;
          updateMessage(agentMsgId, { content: `\n\n**Lỗi AI**: ${error}`, status: 'error', actions: finalActions });
          setIsAgentTyping(false);
          setActiveRequestId(null);
          clearAgentActions();
          clearAgentThoughts();
        },
        setActiveRequestId,
        (action) => {
          setIsAgentTyping(false);
          upsertAgentAction(action);
        },
        (thought, requestId) => {
          setIsAgentTyping(false);
          appendAgentThoughtChunk(requestId, thought);
        },
      );
    } catch (error) {
      const finalActions = useAppStore.getState().agentActions;
      updateMessage(agentMsgId, { content: `\n\n**Lỗi hệ thống**: ${error instanceof Error ? error.message : error}`, status: 'error', actions: finalActions });
      setIsAgentTyping(false);
      setActiveRequestId(null);
      clearAgentActions();
      clearAgentThoughts();
    }
  };

  const handleRegenerate = (message: Message, content: string) => {
    const messagesToSend = replaceUserMessageAndTrim(message.id, content);
    startAgentResponse(messagesToSend);
  };

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

        {messages.length === 0 && !isAgentTyping ? (
          <EmptyState />
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
