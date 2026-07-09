import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useAppStore } from '../store/useAppStore';

export function PromptComposer() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addMessage = useAppStore((s) => s.addMessage);
  const setIsAgentTyping = useAppStore((s) => s.setIsAgentTyping);

  // Auto-resize textarea as content grows
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Add user message
    addMessage({ sender: 'user', content: trimmed, type: 'text' });
    setInput('');

    // Simulate agent typing (placeholder until real AI is wired)
    setIsAgentTyping(true);
    setTimeout(() => {
      setIsAgentTyping(false);
      addMessage({
        sender: 'agent',
        content: `Đã nhận yêu cầu: "${trimmed}"\n\nHệ thống AI đang được tích hợp. Đây chỉ là tin nhắn giữ chỗ.`,
        type: 'text',
      });
    }, 1800);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = input.trim().length > 0;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-[800px] px-6">
      <div
        className="bg-surface rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-outline-variant p-2 flex flex-col gap-2 transition-all focus-within:border-secondary/50 focus-within:shadow-[0_8px_30px_rgb(156,67,38,0.1)]"
      >
        {/* Context Tokens */}
        <div className="flex gap-2 px-2 pt-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-code-base bg-surface-container text-on-surface-variant border border-outline-variant/50">
            <span className="material-symbols-outlined text-[12px]">description</span>
            src/runtime/permissions.ts
          </div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-code-base bg-surface-container text-on-surface-variant border border-outline-variant/50">
            <span className="material-symbols-outlined text-[12px]">folder</span>
            tests/security
          </div>
        </div>

        {/* Input row */}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            id="prompt-input"
            className="w-full bg-transparent border-none focus:ring-0 resize-none font-ui-body text-[15px] text-on-surface placeholder:text-on-surface-variant/50 py-2 px-2 max-h-32 outline-none"
            placeholder="Yêu cầu AI xây dựng, giải thích hoặc refactor..."
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />

          <div className="flex items-center gap-1 pb-1 pr-1">
            <button
              className="p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container"
              title="Đính kèm tệp"
            >
              <span className="material-symbols-outlined text-[20px]">attach_file</span>
            </button>

            <button
              id="send-message-btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all shadow-sm
                ${canSubmit
                  ? 'bg-secondary text-white hover:bg-[#7D2C11] cursor-pointer'
                  : 'bg-surface-container text-on-surface-variant/40 cursor-not-allowed'
                }`}
              title={canSubmit ? 'Gửi tin nhắn (Enter)' : 'Nhập tin nhắn trước'}
            >
              <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
            </button>
          </div>
        </div>

        {/* Hint */}
        <p className="text-[10px] text-on-surface-variant/40 px-2 pb-1 font-ui-body">
          Enter để gửi · Shift+Enter để xuống dòng
        </p>
      </div>
    </div>
  );
}