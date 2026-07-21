import { useState, useRef, useEffect, useMemo, type KeyboardEvent } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Attachment } from '../domain/entities/message';
import { useProviderSettings } from '../application/hooks/useProviderSettings';
import { useAgentChat } from '../application/hooks/useAgentChat';
import { useAttachments } from '../application/hooks/useAttachments';
import { estimateMessageTokens, calculateContextUsagePercent } from '../application/services/tokenEstimator';
import { hasUsableAiConfiguration } from '../domain/services/aiConfiguration';
import { findComposerCommands, type ComposerCommand } from '../application/services/composerCommands';
import { ComposerAttachments } from './chat/ComposerAttachments';
import { ComposerCommandPalette } from './chat/ComposerCommandPalette';
import { ComposerPickerLayer, type ComposerPickerKind } from './chat/ComposerPickerLayer';
import { ComposerSettingsFooter } from './chat/ComposerSettingsFooter';

export function PromptComposer() {
  const [input, setInput] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [dismissedCommandInput, setDismissedCommandInput] = useState<string | null>(null);
  const [activePicker, setActivePicker] = useState<ComposerPickerKind | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { attachedFiles, fileInputRef, handleFileClick, handleFileChange, removeFile, clearFiles } = useAttachments();

  const addMessage = useAppStore((s) => s.addMessage);
  const activeTask = useAppStore((s) => s.activeTask);
  const currentBranch = useAppStore((s) => s.currentBranch);
  const messages = useAppStore((s) => s.messages);
  const settings = useAppStore((s) => s.settings);
  const setActiveView = useAppStore((s) => s.setActiveView);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const createThread = useAppStore((s) => s.createThread);
  const renameActiveThread = useAppStore((s) => s.renameActiveThread);
  const isAgentBusy = useAppStore((s) => s.messages.some((m) => m.sender === 'agent' && m.status === 'sending'));
  const hasAiConfiguration = hasUsableAiConfiguration(settings);
  const activeProvider = settings.providers?.find((provider) => provider.id === settings.activeProviderId);
  const models = activeProvider?.models || [];
  
  const { startAgentResponse, stopAgentResponse, resumeAgentTask } = useAgentChat();
  const {
    setActiveModel: saveActiveModel,
    setFallbackModel: saveFallbackModel,
    setPermissionMode: savePermissionMode,
    settingsNotice,
  } = useProviderSettings();

  const commands = useMemo(() => findComposerCommands(input), [input]);
  const isCommandPaletteOpen = commands.length > 0 && dismissedCommandInput !== input && !isAgentBusy;

  useEffect(() => setSelectedCommandIndex(0), [input]);

  const selectCommand = (command: ComposerCommand) => {
    setDismissedCommandInput(null);
    if (command.action.kind === 'navigate') {
      setInput('');
      setActiveView(command.action.view);
      if (command.action.anchorId) focusElement(command.action.anchorId, true);
    } else if (command.action.kind === 'open-picker') {
      setInput('');
      if (command.action.picker === 'model' && models.length === 0) setActiveView('settings');
      else setActivePicker(command.action.picker);
    } else if (command.action.kind === 'clear-thread') {
      setInput('');
      clearMessages();
    } else if (command.action.kind === 'new-thread') {
      setInput('');
      createThread();
    } else {
      setInput(command.action.value);
      focusElement('prompt-input');
    }
  };

  // Auto-resize textarea as content grows
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  const handleSubmit = async () => {
    if (isCommandPaletteOpen) {
      selectCommand(commands[selectedCommandIndex] ?? commands[0]);
      return;
    }
    const trimmed = input.trim();
    const hasFileErrors = attachedFiles.some((file) => file.error);
    if (!hasAiConfiguration || (!trimmed && attachedFiles.length === 0) || hasFileErrors || isAgentBusy) return;

    const messageAttachments: Attachment[] = attachedFiles.map(({ id, name, type, authorizationToken, mimeType, size, previewUrl }) => ({
      id,
      name,
      type,
      authorizationToken,
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

    if (isCommandPaletteOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const direction = e.key === 'ArrowDown' ? 1 : -1;
      setSelectedCommandIndex((current) => (current + direction + commands.length) % commands.length);
      return;
    }
    if (isCommandPaletteOpen && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault();
      selectCommand(commands[selectedCommandIndex] ?? commands[0]);
      return;
    }
    if (isCommandPaletteOpen && e.key === 'Escape') {
      e.preventDefault();
      setDismissedCommandInput(input);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasFileErrors = attachedFiles.some((file) => file.error);
  const canSubmit = hasAiConfiguration && (input.trim().length > 0 || attachedFiles.length > 0) && !hasFileErrors && !isAgentBusy;
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

  const handlePermissionModeChange = async (permissionMode: typeof settings.permissionMode) => {
    await savePermissionMode(permissionMode);
  };

  const handleFallbackModelChange = async (modelId: string) => {
    await saveFallbackModel(modelId);
  };

  const closePicker = () => {
    setActivePicker(null);
    focusElement('prompt-input');
  };

  return (
    <div className="absolute bottom-4 left-1/2 w-full max-w-[720px] -translate-x-1/2 px-5">
      <div
        className="relative flex flex-col gap-1.5 rounded-2xl border border-outline-variant/60 bg-surface p-2 shadow-[0_8px_30px_var(--theme-shadow)] transition-all focus-within:border-outline focus-within:shadow-[0_10px_36px_var(--theme-shadow)]"
        onBlur={(e) => {
          // Đóng palette khi focus rời khỏi toàn bộ composer (click ra ngoài)
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDismissedCommandInput(input);
          }
        }}
      >
        {isCommandPaletteOpen && <ComposerCommandPalette commands={commands} selectedIndex={selectedCommandIndex} onSelect={selectCommand} />}
        <ComposerPickerLayer
          active={activePicker} models={models} activeModelId={settings.activeModelId}
          permissionMode={settings.permissionMode} currentThreadTitle={activeTask ?? 'Chat mới'}
          estimatedTokens={estimatedContextTokens} contextWindow={activeContextWindow} contextUsagePercent={contextUsagePercent}
          providerName={activeProvider?.name} fallbackModelId={settings.fallbackModelId} workspacePath={settings.workspacePath} currentBranch={currentBranch}
          onModelSelect={handleModelChange} onPermissionSelect={handlePermissionModeChange}
          onResume={resumeAgentTask} onRename={renameActiveThread} onClose={closePicker}
        />
        <input
          type="file"
          multiple
          hidden
          ref={fileInputRef}
          onChange={handleFileChange}
        />

        <ComposerAttachments files={attachedFiles} onRemove={removeFile} />

        {/* Input row */}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            id="prompt-input"
            className="w-full max-h-32 resize-none border-none bg-transparent px-2 py-2 font-ui-body text-[14px] text-on-surface outline-none placeholder:text-on-surface-variant focus:ring-0"
            placeholder="Làm bất cứ điều gì"
            rows={1}
            value={input}
            onChange={(e) => { setInput(e.target.value); setDismissedCommandInput(null); }}
            onKeyDown={handleKeyDown}
          />

          <div className="flex items-center gap-1 pb-1 pr-1">
            <button
              onClick={handleFileClick}
              className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-interactive-hover hover:text-on-surface"
              title="Đính kèm tệp"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>

            <button
              id="send-message-btn"
              onClick={isAgentBusy ? handleStop : handleSubmit}
              disabled={!isAgentBusy && !canSubmit}
              className={`w-8 h-8 flex items-center justify-center rounded-full transition-all shadow-sm
                ${isAgentBusy
                  ? 'bg-error text-on-error hover:bg-error/90 cursor-pointer'
                  : canSubmit
                    ? 'bg-secondary text-on-secondary hover:bg-secondary-hover cursor-pointer'
                    : 'bg-surface-container text-on-surface-variant/40 cursor-not-allowed'
                }`}
              title={isAgentBusy ? 'Dừng phản hồi' : !hasAiConfiguration ? 'Cần cấu hình AI trước' : canSubmit ? 'Gửi tin nhắn (Enter)' : 'Nhập tin nhắn trước'}
            >
              <span className="material-symbols-outlined text-[18px]">{isAgentBusy ? 'stop' : 'arrow_upward'}</span>
            </button>
          </div>
        </div>

        {settingsNotice && <p className="px-2 text-[11px] text-error">{settingsNotice}</p>}

        <ComposerSettingsFooter
          settings={settings}
          models={models}
          providerName={activeProvider?.name}
          contextWindow={activeContextWindow}
          estimatedTokens={estimatedContextTokens}
          usagePercent={contextUsagePercent}
          onPermissionModeChange={(value) => void handlePermissionModeChange(value)}
          onActiveModelChange={(value) => void handleModelChange(value)}
          onFallbackModelChange={(value) => void handleFallbackModelChange(value)}
        />
      </div>
    </div>
  );
}

function focusElement(id: string, scroll = false) {
  window.setTimeout(() => {
    const element = document.getElementById(id);
    if (scroll) element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (element instanceof HTMLElement) element.focus();
  }, 0);
}
