import type { AIModel, AppSettings, PermissionMode } from '../../domain/entities/settings';
import { formatContextWindow } from '../../application/services/tokenEstimator';
import { TokenProgressRing } from './TokenProgressRing';

interface ComposerSettingsFooterProps {
  settings: AppSettings;
  models: AIModel[];
  providerName?: string;
  contextWindow?: number;
  estimatedTokens: number;
  usagePercent: number | null;
  onPermissionModeChange: (value: PermissionMode) => void;
  onActiveModelChange: (value: string) => void;
  onFallbackModelChange: (value: string) => void;
}

export function ComposerSettingsFooter(props: ComposerSettingsFooterProps) {
  const { settings, models, providerName, contextWindow, estimatedTokens, usagePercent } = props;
  return (
    <div className="flex items-center justify-between px-2 pb-1">
      <p className="font-ui-body text-[10px] text-on-surface-variant/40">Enter để gửi · Shift+Enter để xuống dòng</p>
      <div className="flex items-center gap-2">
        <select
          id="permission-mode-select"
          value={settings.permissionMode}
          onChange={(event) => props.onPermissionModeChange(event.target.value as PermissionMode)}
          className="max-w-[170px] cursor-pointer rounded border border-outline-variant/30 bg-surface px-2 py-0.5 text-[11px] text-on-surface-variant/80 outline-none transition-colors hover:bg-surface-container"
          title="Chế độ quyền agent"
        >
          <option value="read-only" className="bg-surface text-on-surface">read-only</option>
          <option value="workspace-write" className="bg-surface text-on-surface">workspace-write</option>
          <option value="danger-full-access" className="bg-surface text-on-surface">danger-full-access</option>
        </select>
        {contextWindow && usagePercent !== null && (
          <div title={`Local realtime estimate: khoảng ${estimatedTokens.toLocaleString()} / ${contextWindow.toLocaleString()} tokens (${usagePercent}%).`}>
            <TokenProgressRing percent={usagePercent} />
          </div>
        )}
        {!!models.length && (
          <>
            <select
              id="active-model-select"
              value={settings.activeModelId || ''}
              onChange={(event) => props.onActiveModelChange(event.target.value)}
              className="max-w-[150px] cursor-pointer truncate rounded border border-outline-variant/30 bg-surface px-2 py-0.5 text-[11px] text-on-surface-variant/80 outline-none transition-colors hover:bg-surface-container"
              title={`Chọn Model (${providerName})${contextWindow ? ` · context ${formatContextWindow(contextWindow)}` : ''}`}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id} className="bg-surface text-on-surface">
                  {model.id}{model.contextWindow ? ` · ${formatContextWindow(model.contextWindow)}` : ''}
                </option>
              ))}
            </select>
            <select
              value={settings.fallbackModelId || ''}
              onChange={(event) => props.onFallbackModelChange(event.target.value)}
              className="max-w-[130px] cursor-pointer truncate rounded border border-outline-variant/30 bg-surface px-2 py-0.5 text-[11px] text-on-surface-variant/80 outline-none transition-colors hover:bg-surface-container"
              title="Model dự phòng khi model chính quá tải hoặc lỗi tạm thời"
            >
              <option value="">Không fallback</option>
              {models.filter((model) => model.id !== settings.activeModelId).map((model) => (
                <option key={model.id} value={model.id} className="bg-surface text-on-surface">Fallback: {model.id}</option>
              ))}
            </select>
          </>
        )}
      </div>
    </div>
  );
}
