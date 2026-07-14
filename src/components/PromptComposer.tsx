import { useState, useRef, useEffect, useMemo, type KeyboardEvent } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Attachment } from '../domain/entities/message';
import type { PermissionMode } from '../domain/entities/settings';
import { useProviderSettings } from '../application/hooks/useProviderSettings';
import { useAgentChat } from '../application/hooks/useAgentChat';
import { useAttachments } from '../application/hooks/useAttachments';
import { estimateMessageTokens, formatContextWindow, calculateContextUsagePercent } from '../application/services/tokenEstimator';
import { TokenProgressRing } from './chat/TokenProgressRing';
import { hasUsableAiConfiguration } from '../domain/services/aiConfiguration';

export function PromptComposer() {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { attachedFiles, fileInputRef, handleFileClick, handleFileChange, removeFile, clearFiles } = useAttachments();

  const addMessage = useAppStore((s) => s.addMessage);
  const messages = useAppStore((s) => s.messages);
  const settings = useAppStore((s) => s.settings);
  const isAgentBusy = useAppStore((s) => s.messages.some((m) => m.sender === 'agent' && m.status === 'sending'));
  const hasAiConfiguration = hasUsableAiConfiguration(settings);
  
  const { startAgentResponse, stopAgentResponse } = useAgentChat();
  const { setActiveModel: saveActiveModel, setFallbackModel: saveFallbackModel, setPermissionMode: savePermissionMode } = useProviderSettings();

  // Auto-resize textarea as content grows
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    const hasFileErrors = attachedFiles.some((file) => file.error);
    if (!hasAiConfiguration || (!trimmed && attachedFiles.length === 0) || hasFileErrors || isAgentBusy) return;

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
    clearFiles();

    // Get full history including the one we just added
    const messagesToSend = [...useAppStore.getState().messages];

    startAgentResponse(messagesToSend);
  };

  const handleStop = async () => {
    stopAgentResponse();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasFileErrors = attachedFiles.some((file) => file.error);
  const canSubmit = hasAiConfiguration && (input.trim().length > 0 || attachedFiles.length > 0) && !hasFileErrors && !isAgentBusy;
  const activeProvider = settings.providers?.find(p => p.id === settings.activeProviderId);
  const models = activeProvider?.models || [];
  const activeModel = models.find((model) => model.id === settings.activeModelId);
  const activeContextWindow = activeModel?.contextWindow;
  const estimatedContextTokens = useMemo(() => {
    const draftContent = input.trim();
    const draftTokens = draftContent || attachedFiles.length > 0
      ? estimateMessageTokens({
        sender: 'user',
        content: draftContent,
        attachments: attachedFiles,
      })
      : 0;

    return messages.reduce((total, message) => total + estimateMessageTokens(message), 0) + draftTokens;
  }, [attachedFiles, input, messages]);
  const contextUsagePercent = calculateContextUsagePercent(estimatedContextTokens, activeContextWindow);

  const handleModelChange = async (modelId: string) => {
    await saveActiveModel(modelId);
  };

  const handlePermissionModeChange = async (permissionMode: PermissionMode) => {
    await savePermissionMode(permissionMode);
  };

  const handleFallbackModelChange = async (modelId: string) => {
    await saveFallbackModel(modelId);
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
              title={isAgentBusy ? 'Dừng phản hồi' : !hasAiConfiguration ? 'Cần cấu hình AI trước' : canSubmit ? 'Gửi tin nhắn (Enter)' : 'Nhập tin nhắn trước'}
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

            {activeContextWindow && contextUsagePercent !== null && (
              <div title={`Local realtime estimate: khoảng ${estimatedContextTokens.toLocaleString()} / ${activeContextWindow.toLocaleString()} tokens (${contextUsagePercent}%).`}>
                <TokenProgressRing percent={contextUsagePercent} />
              </div>
            )}

            {models.length > 0 ? (
              <>
                <select
                  value={settings.activeModelId || ''}
                  onChange={(e) => handleModelChange(e.target.value)}
                  className="text-[11px] bg-surface text-on-surface-variant/80 border border-outline-variant/30 outline-none cursor-pointer rounded px-2 py-0.5 hover:bg-surface-container transition-colors max-w-[150px] truncate"
                  title={`Chọn Model (${activeProvider?.name})${activeContextWindow ? ` · context ${formatContextWindow(activeContextWindow)}` : ''}`}
                >
                  {models.map(model => (
                    <option key={model.id} value={model.id} className="bg-surface text-on-surface">
                      {model.id}{model.contextWindow ? ` · ${formatContextWindow(model.contextWindow)}` : ''}
                    </option>
                  ))}
                </select>
                <select
                  value={settings.fallbackModelId || ''}
                  onChange={(e) => handleFallbackModelChange(e.target.value)}
                  className="text-[11px] bg-surface text-on-surface-variant/80 border border-outline-variant/30 outline-none cursor-pointer rounded px-2 py-0.5 hover:bg-surface-container transition-colors max-w-[130px] truncate"
                  title="Model dự phòng khi model chính quá tải hoặc lỗi tạm thời"
                >
                  <option value="">Không fallback</option>
                  {models.filter((model) => model.id !== settings.activeModelId).map((model) => (
                    <option key={model.id} value={model.id} className="bg-surface text-on-surface">Fallback: {model.id}</option>
                  ))}
                </select>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
