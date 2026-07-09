import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react';
import { useAppStore, type Attachment, type PermissionMode } from '../store/useAppStore';

type PendingAttachment = Attachment & {
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
  const activeRequestId = useAppStore((s) => s.activeRequestId);
  const setActiveRequestId = useAppStore((s) => s.setActiveRequestId);
  const upsertAgentAction = useAppStore((s) => s.upsertAgentAction);
  const clearAgentActions = useAppStore((s) => s.clearAgentActions);
  const appendAgentThoughtChunk = useAppStore((s) => s.appendAgentThoughtChunk);
  const clearAgentThoughts = useAppStore((s) => s.clearAgentThoughts);
  const isAgentBusy = useAppStore((s) => s.messages.some((m) => m.sender === 'agent' && m.status === 'sending'));

  // Auto-resize textarea as content grows
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  useEffect(() => {
    const handleDroppedFiles = (event: Event) => {
      const files = (event as CustomEvent<File[]>).detail;
      if (Array.isArray(files)) {
        addFiles(files);
      }
    };

    window.addEventListener('agentstudio:add-files', handleDroppedFiles);
    return () => {
      window.removeEventListener('agentstudio:add-files', handleDroppedFiles);
    };
  }, []);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const addFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const validFiles = files.filter(file => {
      if (file.name.endsWith('.exe') || file.name.endsWith('.dll')) {
        alert(`Không hỗ trợ đính kèm file định dạng này: ${file.name}`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    const newAttachments: PendingAttachment[] = await Promise.all(validFiles.map(async file => {
      const type = file.type.startsWith('image/') ? 'image' : 
                   file.type.startsWith('audio/') ? 'audio' : 
                   file.type.startsWith('video/') ? 'video' : 'text';
      const filePath = window.agentStudio?.getFilePath(file) || '';
      return {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        filePath,
        mimeType: file.type,
        size: file.size,
        previewUrl: type === 'image' || type === 'audio' || type === 'video'
          ? URL.createObjectURL(file)
          : undefined,
        error: filePath ? undefined : 'Không lấy được đường dẫn tệp.',
      };
    }));

    setAttachedFiles(prev => [...prev, ...newAttachments]);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files || []));

    // Reset input value so the same file can be selected again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (id: string) => {
    setAttachedFiles(prev => {
      const removed = prev.find((file) => file.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleSubmit = async () => {
    const trimmed = input.trim();
    const hasFileErrors = attachedFiles.some((file) => file.error);
    if ((!trimmed && attachedFiles.length === 0) || hasFileErrors || isAgentBusy) return;

    const messageAttachments: Attachment[] = attachedFiles.map(({ id, name, type, filePath, mimeType, size, previewUrl }) => ({
      id,
      name,
      type,
      filePath,
      mimeType,
      size,
      previewUrl,
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
    clearAgentActions();
    clearAgentThoughts();
    setIsAgentTyping(true);

    const agentMsgId = addMessage({ sender: 'agent', content: '', type: 'text', status: 'sending' });
    
    // Get full history including the one we just added
    const currentMessages = useAppStore.getState().messages;
    // Remove the empty agent message from the history we send to the API
    const messagesToSend = currentMessages.filter(m => m.id !== agentMsgId);
    let hasStartedResponse = false;

    try {
      const { streamChatCompletion } = await import('../services/ai');

      await streamChatCompletion(
        messagesToSend,
        (chunk) => {
          if (!hasStartedResponse) {
            hasStartedResponse = true;
          }
          setIsAgentTyping(false); // Stop typing indicator once we get first chunk
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
    } catch (e) {
      const finalActions = useAppStore.getState().agentActions;
      updateMessage(agentMsgId, { content: `\n\n**Lỗi hệ thống**: ${e instanceof Error ? e.message : e}`, status: 'error', actions: finalActions });
      setIsAgentTyping(false);
      setActiveRequestId(null);
      clearAgentActions();
      clearAgentThoughts();
    }
  };

  const handleStop = async () => {
    if (!activeRequestId) return;
    const { stopChatCompletion } = await import('../services/ai');
    stopChatCompletion(activeRequestId);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasFileErrors = attachedFiles.some((file) => file.error);
  const canSubmit = (input.trim().length > 0 || attachedFiles.length > 0) && !hasFileErrors && !isAgentBusy;

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

  const handlePermissionModeChange = async (permissionMode: PermissionMode) => {
    setSettings({ permissionMode });
    try {
      if (!window.agentStudio) throw new Error('Electron bridge is not available.');
      const nextSettings = await window.agentStudio.setPermissionMode(permissionMode);
      setSettings(nextSettings);
    } catch (error) {
      console.error('Failed to save permission mode', error);
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
                {file.error ? (
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
                <span className={file.error ? 'opacity-50' : ''} title={file.error || file.filePath}>
                  {file.name}
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
              onClick={isAgentBusy ? handleStop : handleSubmit}
              disabled={!isAgentBusy && !canSubmit}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all shadow-sm
                ${isAgentBusy
                  ? 'bg-error text-white hover:bg-error/90 cursor-pointer'
                  : canSubmit
                  ? 'bg-secondary text-white hover:bg-[#7D2C11] cursor-pointer'
                  : 'bg-surface-container text-on-surface-variant/40 cursor-not-allowed'
                }`}
              title={isAgentBusy ? 'Dừng phản hồi' : canSubmit ? 'Gửi tin nhắn (Enter)' : 'Nhập tin nhắn trước'}
            >
              <span className="material-symbols-outlined text-[18px]">{isAgentBusy ? 'stop' : 'arrow_upward'}</span>
            </button>
          </div>
        </div>

        {/* Footer info: Hint + Model Select */}
        <div className="flex justify-between items-center px-2 pb-1">
          <p className="text-[10px] text-on-surface-variant/40 font-ui-body">
            Enter để gửi · Shift+Enter để xuống dòng
          </p>
          
          <div className="flex items-center gap-2">
            <select
              value={settings.permissionMode}
              onChange={(e) => handlePermissionModeChange(e.target.value as PermissionMode)}
              className="text-[11px] bg-surface text-on-surface-variant/80 border border-outline-variant/30 outline-none cursor-pointer rounded px-2 py-0.5 hover:bg-surface-container transition-colors max-w-[170px]"
              title="Chế độ quyền agent"
            >
              <option value="read-only" className="bg-surface text-on-surface">read-only</option>
              <option value="workspace-write" className="bg-surface text-on-surface">workspace-write</option>
              <option value="danger-full-access" className="bg-surface text-on-surface">danger-full-access</option>
            </select>

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
    </div>
  );
}
