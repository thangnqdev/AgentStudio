import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { useAppStore, type Attachment } from '../store/useAppStore';

export function PromptComposer() {
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const addMessage = useAppStore((s) => s.addMessage);
  const setIsAgentTyping = useAppStore((s) => s.setIsAgentTyping);
  const appendMessageContent = useAppStore((s) => s.appendMessageContent);
  const updateMessage = useAppStore((s) => s.updateMessage);
  const settings = useAppStore((s) => s.settings);

  // Auto-resize textarea as content grows
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      if (file.type.startsWith('audio/') || file.type.startsWith('video/') || file.name.endsWith('.exe') || file.name.endsWith('.dll')) {
        alert(`Không hỗ trợ đính kèm file định dạng này: ${file.name}`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        if (data) {
          setAttachedFiles(prev => {
            if (prev.some(f => f.name === file.name)) return prev;
            const type = file.type.startsWith('image/') ? 'image' : 'text';
            return [...prev, { id: Math.random().toString(36).substring(7), name: file.name, type, data }];
          });
        }
      };

      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
    
    // Reset input value so the same file can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed && attachedFiles.length === 0) return;

    // Add user message
    addMessage({ 
      sender: 'user', 
      content: trimmed, 
      type: 'text', 
      attachments: attachedFiles.length > 0 ? attachedFiles : undefined 
    });
    
    setInput('');
    setAttachedFiles([]);
    setIsAgentTyping(true);

    const agentMsgId = addMessage({ sender: 'agent', content: '', type: 'text', status: 'sending' });
    
    // Get full history including the one we just added
    const currentMessages = useAppStore.getState().messages;
    // Remove the empty agent message from the history we send to the API
    const messagesToSend = currentMessages.filter(m => m.id !== agentMsgId);

    try {
      const { streamChatCompletion } = await import('../services/ai');
      
      await streamChatCompletion(
        messagesToSend,
        settings.baseUrl,
        settings.apiKey,
        (chunk) => {
          setIsAgentTyping(false); // Stop typing indicator once we get first chunk
          appendMessageContent(agentMsgId, chunk);
        },
        () => {
          updateMessage(agentMsgId, { status: 'done' });
          setIsAgentTyping(false);
        },
        (error) => {
          updateMessage(agentMsgId, { content: `\n\n**Lỗi AI**: ${error}`, status: 'error' });
          setIsAgentTyping(false);
        },
        settings.selectedModel
      );
    } catch (e) {
      updateMessage(agentMsgId, { content: `\n\n**Lỗi hệ thống**: ${e}`, status: 'error' });
      setIsAgentTyping(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSubmit = input.trim().length > 0 || attachedFiles.length > 0;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-[800px] px-6">
      <div
        className="bg-surface rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-outline-variant p-2 flex flex-col gap-2 transition-all focus-within:border-secondary/50 focus-within:shadow-[0_8px_30px_rgb(156,67,38,0.1)]"
      >
        <input 
          type="file" 
          multiple 
          hidden 
          ref={fileInputRef} 
          onChange={handleFileChange} 
        />

        {/* Attached Files Tokens */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 pt-1">
            {attachedFiles.map(file => (
              <div 
                key={file.id} 
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-code-base bg-surface-container text-on-surface-variant border border-outline-variant/50"
              >
                {file.type === 'image' ? (
                  <span className="material-symbols-outlined text-[12px]">image</span>
                ) : (
                  <span className="material-symbols-outlined text-[12px]">description</span>
                )}
                {file.name}
                <button 
                  onClick={() => removeFile(file.id)}
                  className="ml-1 hover:text-error transition-colors flex items-center justify-center"
                  title="Xóa tệp"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </div>
            ))}
          </div>
        )}

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
              onClick={handleFileClick}
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