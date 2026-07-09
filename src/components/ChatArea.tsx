import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useAppStore, type Message } from '../store/useAppStore';

type AgentContentPart =
  | { type: 'text'; value: string }
  | { type: 'code'; language: string; value: string };

type TextRenderPart =
  | { type: 'text'; value: string }
  | { type: 'action'; toolName: string; args: string; status?: 'ok' | 'error'; output: string };

function UserMessage({ msg, onRegenerate }: { msg: Message; onRegenerate: (message: Message, content: string) => void }) {
  const handleEdit = () => {
    const nextContent = window.prompt('Sửa tin nhắn và regenerate:', msg.content);
    if (nextContent === null) return;
    if (!nextContent.trim()) return;
    onRegenerate(msg, nextContent.trim());
  };

  return (
    <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/50 relative group">
      <div className="absolute -left-3 top-6 w-6 h-6 rounded-full bg-primary-container text-on-primary flex items-center justify-center border-2 border-background z-10">
        <span className="material-symbols-outlined text-[14px]">person</span>
      </div>

      <button
        onClick={handleEdit}
        className="absolute right-3 top-3 w-7 h-7 rounded flex items-center justify-center text-on-surface-variant opacity-0 group-hover:opacity-100 hover:bg-surface-container-high transition"
        title="Sửa và regenerate"
      >
        <span className="material-symbols-outlined text-[16px]">edit</span>
      </button>
      
      {msg.attachments && msg.attachments.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {msg.attachments.map(att => (
            <div key={att.id} className="relative group">
              {att.type === 'image' ? (
                <div className="relative rounded-lg overflow-hidden border border-outline-variant/50 w-32 h-32">
                  <img src={att.data} alt={att.name} className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] truncate px-1.5 py-0.5" title={att.name}>
                    {att.name}
                  </div>
                </div>
              ) : att.type === 'video' ? (
                <div className="relative rounded-lg overflow-hidden border border-outline-variant/50 w-48 h-32 bg-black flex flex-col">
                  <video src={att.data} controls className="w-full h-full object-contain" />
                  <div className="absolute top-0 w-full bg-gradient-to-b from-black/60 to-transparent text-white text-[10px] truncate px-1.5 py-1" title={att.name}>
                    {att.name}
                  </div>
                </div>
              ) : att.type === 'audio' ? (
                <div className="relative rounded-lg overflow-hidden border border-outline-variant/50 bg-surface-container-high p-2 flex flex-col gap-1 w-64">
                  <div className="text-[11px] font-code-base text-on-surface truncate" title={att.name}>
                    <span className="material-symbols-outlined text-[12px] align-middle mr-1">audio_file</span>
                    {att.name}
                  </div>
                  <audio src={att.data} controls className="w-full h-8" />
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-code-base bg-surface text-on-surface-variant border border-outline-variant/50" title={att.name}>
                  <span className="material-symbols-outlined text-[16px]">description</span>
                  <span className="max-w-[120px] truncate">{att.name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="font-ui-body text-ui-body text-on-surface leading-relaxed text-[15px] whitespace-pre-wrap pr-7">
        {msg.content}
      </p>
      <span className="text-[11px] text-on-surface-variant/50 mt-2 block">
        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
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

function ActionBlock({ action }: { action: Extract<TextRenderPart, { type: 'action' }> }) {
  const [isOpen, setIsOpen] = useState(false);
  const ok = action.status === 'ok';
  const hasStatus = Boolean(action.status);

  return (
    <div className="my-2 rounded-lg border border-outline-variant/50 bg-surface-container-low overflow-hidden">
      <button
        onClick={() => setIsOpen((value) => !value)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-on-surface-variant hover:bg-surface-container-high"
      >
        <span className={`material-symbols-outlined text-[16px] ${hasStatus ? ok ? 'text-[#27642a]' : 'text-error' : 'text-secondary animate-pulse'}`}>
          {hasStatus ? ok ? 'check_circle' : 'error' : 'settings'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-ui-label-bold text-on-surface">
            {hasStatus ? ok ? 'Hoàn tất tool' : 'Tool bị chặn hoặc lỗi' : 'Đang chạy tool'}: {action.toolName}
          </div>
          {action.args && <div className="font-code-base text-[11px] truncate">{action.args}</div>}
        </div>
        <span className="material-symbols-outlined text-[16px]">{isOpen ? 'expand_less' : 'expand_more'}</span>
      </button>

      {isOpen && (
        <div className="border-t border-outline-variant/50 px-3 py-2">
          {action.output ? (
            <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap font-code-base text-[11px] leading-5 text-on-surface-variant">{action.output}</pre>
          ) : (
            <div className="text-[12px] text-on-surface-variant/70">Chưa có output.</div>
          )}
        </div>
      )}
    </div>
  );
}

function parseTextRenderParts(text: string): TextRenderPart[] {
  const parts: TextRenderPart[] = [];
  const lines = text.split('\n');
  let textBuffer: string[] = [];

  const flushText = () => {
    if (textBuffer.length === 0) return;
    const value = textBuffer.join('\n');
    if (value) parts.push({ type: 'text', value });
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

    let status: 'ok' | 'error' | undefined;
    const output: string[] = [];
    let cursor = index + 1;
    while (cursor < lines.length) {
      const nextLine = lines[cursor];
      if (/^\[tool:([^\]]+)\]/.test(nextLine)) break;
      if (nextLine === '[ok]') {
        status = 'ok';
      } else if (nextLine === '[blocked/error]') {
        status = 'error';
      } else {
        output.push(nextLine);
      }
      cursor += 1;
    }

    parts.push({
      type: 'action',
      toolName: toolMatch[1],
      args: toolMatch[2] || '',
      status,
      output: output.join('\n').trim(),
    });
    index = cursor - 1;
  }

  flushText();
  return parts;
}

function TextBlock({ text }: { text: string }) {
  const parts = parseTextRenderParts(text);

  return (
    <div className="font-ui-body text-ui-body text-on-surface-variant leading-relaxed text-[15px] whitespace-pre-wrap">
      {parts.map((part, index) => (
        part.type === 'action'
          ? <ActionBlock key={`action-${part.toolName}-${index}`} action={part} />
          : <span key={`text-${index}`}>{part.value}</span>
      ))}
    </div>
  );
}

function parseAgentContent(content: string): AgentContentPart[] {
  const parts: AgentContentPart[] = [];
  const codeFenceRegex = /```([\w.+-]*)\n([\s\S]*?)```/g;
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

  return parts.length > 0 ? parts : [{ type: 'text', value: content }];
}

function AgentMessage({ msg }: { msg: Message }) {
  if (!msg.content && msg.status === 'sending') return null;

  const parts = parseAgentContent(msg.content);

  return (
    <div className="pl-8 border-l border-outline-variant relative py-2">
      <div className="absolute -left-[17px] top-4 w-8 h-8 rounded-full bg-surface border border-outline-variant flex items-center justify-center text-secondary bg-surface-bright shadow-sm">
        <span className="material-symbols-outlined text-[18px]">smart_toy</span>
      </div>
      <div className="max-w-none">
        {parts.map((part, index) => (
          part.type === 'code'
            ? <CodeBlock key={`code-${index}`} language={part.language} code={part.value} />
            : <TextBlock key={`text-${index}`} text={part.value} />
        ))}
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
        Hãy mô tả những gì bạn muốn xây dựng, giải thích hoặc refactor. Kéo thả file vào đây để thêm ngữ cảnh.
      </p>
    </div>
  );
}

export function ChatArea() {
  const messages = useAppStore((s) => s.messages);
  const activeTask = useAppStore((s) => s.activeTask);
  const isAgentTyping = useAppStore((s) => s.isAgentTyping);
  const addMessage = useAppStore((s) => s.addMessage);
  const updateMessage = useAppStore((s) => s.updateMessage);
  const appendMessageContent = useAppStore((s) => s.appendMessageContent);
  const setIsAgentTyping = useAppStore((s) => s.setIsAgentTyping);
  const setActiveRequestId = useAppStore((s) => s.setActiveRequestId);
  const replaceUserMessageAndTrim = useAppStore((s) => s.replaceUserMessageAndTrim);

  const [isDragging, setIsDragging] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAgentTyping]);

  const startAgentResponse = async (messagesToSend: Message[]) => {
    setIsAgentTyping(true);
    const agentMsgId = addMessage({ sender: 'agent', content: '', type: 'text', status: 'sending' });

    try {
      const { streamChatCompletion } = await import('../services/ai');
      await streamChatCompletion(
        messagesToSend,
        (chunk) => {
          setIsAgentTyping(false);
          appendMessageContent(agentMsgId, chunk);
        },
        () => {
          updateMessage(agentMsgId, { status: 'done' });
          setIsAgentTyping(false);
          setActiveRequestId(null);
        },
        (error) => {
          updateMessage(agentMsgId, { content: `\n\n**Lỗi AI**: ${error}`, status: 'error' });
          setIsAgentTyping(false);
          setActiveRequestId(null);
        },
        setActiveRequestId,
      );
    } catch (error) {
      updateMessage(agentMsgId, { content: `\n\n**Lỗi hệ thống**: ${error instanceof Error ? error.message : error}`, status: 'error' });
      setIsAgentTyping(false);
      setActiveRequestId(null);
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

      <div className="max-w-[900px] mx-auto w-full px-6 pt-8 flex flex-col gap-8">
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
