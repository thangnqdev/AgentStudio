import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { useAppStore, type Attachment } from '../store/useAppStore';

type PendingAttachment = Attachment & {
  isLoading: boolean;
  file?: File;
  error?: string;
};

export function PromptComposer() {
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<PendingAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const addMessage = useAppStore((s) => s.addMessage);
  const setIsAgentTyping = useAppStore((s) => s.setIsAgentTyping);
  const appendMessageContent = useAppStore((s) => s.appendMessageContent);
  const updateMessage = useAppStore((s) => s.updateMessage);
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const isAgentBusy = useAppStore((s) => s.messages.some((m) => m.sender === 'agent' && m.status === 'sending'));

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

    const validFiles = files.filter(file => {
      if (file.name.endsWith('.exe') || file.name.endsWith('.dll')) {
        alert(`Không hỗ trợ đính kèm file định dạng này: ${file.name}`);
        return false;
      }
      const MAX_SIZE = 20 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        alert(`File ${file.name} quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB). Vui lòng chọn file dưới 20MB.`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    // Add placeholders with loading state
    const newAttachments: PendingAttachment[] = validFiles.map(file => {
      const type = file.type.startsWith('image/') ? 'image' : 
                   file.type.startsWith('audio/') ? 'audio' : 
                   file.type.startsWith('video/') ? 'video' : 'text';
      return { 
        id: crypto.randomUUID(),
        name: file.name, 
        type,
        data: '', 
        isLoading: true,
        file // temporary reference
      };
    });

    setAttachedFiles(prev => [...prev, ...newAttachments]);

    newAttachments.forEach(att => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        if (data) {
          setAttachedFiles(prev => prev.map(f => 
            f.id === att.id ? { ...f, data, isLoading: false } : f
          ));
        }
      };
      reader.onerror = () => {
        setAttachedFiles(prev => prev.map(f =>
          f.id === att.id ? { ...f, isLoading: false, error: 'Không đọc được tệp.' } : f
        ));
      };
      reader.onabort = () => {
        setAttachedFiles(prev => prev.map(f =>
          f.id === att.id ? { ...f, isLoading: false, error: 'Đã hủy đọc tệp.' } : f
        ));
      };

      if (att.type === 'image' || att.type === 'audio' || att.type === 'video') {
        reader.readAsDataURL(att.file as File);
      } else {
        reader.readAsText(att.file as File);
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
    const isProcessingFiles = attachedFiles.some((file) => file.isLoading);
    const hasFileErrors = attachedFiles.some((file) => file.error);
    if ((!trimmed && attachedFiles.length === 0) || isProcessingFiles || hasFileErrors || isAgentBusy) return;

    const messageAttachments: Attachment[] = attachedFiles.map(({ id, name, type, data }) => ({
      id,
      name,
      type,
      data,
    }));

    // Add user message
    addMessage({ 
      sender: 'user', 
      content: trimmed, 
      type: 'text', 
      attachments: messageAttachments.length > 0 ? messageAttachments : undefined 
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
        }
      );
    } catch (e) {
      updateMessage(agentMsgId, { content: `\n\n**Lỗi hệ thống**: ${e instanceof Error ? e.message : e}`, status: 'error' });
      setIsAgentTyping(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isProcessingFiles = attachedFiles.some((file) => file.isLoading);
  const hasFileErrors = attachedFiles.some((file) => file.error);
  const canSubmit = (input.trim().length > 0 || attachedFiles.length > 0) && !isProcessingFiles && !hasFileErrors && !isAgentBusy;

  const handleModelChange = async (modelId: string) => {
    setSettings({ activeModelId: modelId });
    try {
      if (!window.agentStudio) throw new Error('Electron bridge is not available.');
      const nextSettings = await window.agentStudio.setActiveModel(modelId);
      setSettings(nextSettings);
    } catch (error) {
      console.error('Failed to save active model', error);
    }
  };

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
                {file.isLoading ? (
                  <div className="relative flex h-3 w-3 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-on-surface-variant opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-on-surface-variant"></span>
                  </div>
                ) : file.error ? (
                  <span className="material-symbols-outlined text-[12px] text-error">error</span>
                ) : file.type === 'image' ? (
                  <span className="material-symbols-outlined text-[12px]">image</span>
                ) : file.type === 'audio' ? (
                  <span className="material-symbols-outlined text-[12px]">audio_file</span>
                ) : file.type === 'video' ? (
                  <span className="material-symbols-outlined text-[12px]">video_file</span>
                ) : (
                  <span className="material-symbols-outlined text-[12px]">description</span>
                )}
                <span className={file.isLoading || file.error ? 'opacity-50' : ''} title={file.error}>
                  {file.name}
                  {file.isLoading && ' (Đang đọc...)'}
                  {file.error && ' (Lỗi)'}
                </span>
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
              title={canSubmit ? 'Gửi tin nhắn (Enter)' : isAgentBusy ? 'Đợi phản hồi hiện tại hoàn tất' : 'Nhập tin nhắn trước'}
            >
              <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
            </button>
          </div>
        </div>

        {/* Footer info: Hint + Model Select */}
        <div className="flex justify-between items-center px-2 pb-1">
          <p className="text-[10px] text-on-surface-variant/40 font-ui-body">
            Enter để gửi · Shift+Enter để xuống dòng
          </p>
          
          {(() => {
            const activeProvider = settings.providers?.find(p => p.id === settings.activeProviderId);
            const models = activeProvider?.models || [];
            
            return models.length > 0 ? (
              <select
                value={settings.activeModelId || ''}
                onChange={(e) => handleModelChange(e.target.value)}
                className="text-[11px] bg-surface text-on-surface-variant/80 border border-outline-variant/30 outline-none cursor-pointer rounded px-2 py-0.5 hover:bg-surface-container transition-colors max-w-[150px] truncate"
                title={`Chọn Model (${activeProvider?.name})`}
              >
                {models.map(m => (
                  <option key={m} value={m} className="bg-surface text-on-surface">{m}</option>
                ))}
              </select>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}
