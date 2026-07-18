import { useAppVersion } from '../../application/hooks/useAppVersion';
import type { PermissionMode } from '../../domain/entities/settings';

interface ComposerStatusPanelProps {
  providerName?: string;
  activeModelId: string | null;
  fallbackModelId: string | null;
  permissionMode: PermissionMode;
  workspacePath: string;
  currentBranch: string | null;
  onClose: () => void;
}

export function ComposerStatusPanel(props: ComposerStatusPanelProps) {
  const version = useAppVersion();
  const rows = [
    ['AgentStudio', version ? `v${version}` : 'đang đọc phiên bản'],
    ['Provider', props.providerName ?? 'chưa cấu hình'],
    ['Model', props.activeModelId ?? 'chưa chọn'],
    ['Fallback', props.fallbackModelId ?? 'không bật'],
    ['Quyền', props.permissionMode],
    ['Workspace', props.workspacePath || 'chưa chọn'],
    ['Git branch', props.currentBranch ?? 'không có Git'],
  ];
  return (
    <div className="absolute inset-x-0 bottom-full z-20 mb-2 rounded-xl border border-outline-variant bg-surface p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-ui-label-bold uppercase tracking-wide text-on-surface-variant">Trạng thái phiên</p>
        <button type="button" onClick={props.onClose} className="px-2 text-xs text-on-surface-variant">Đóng</button>
      </div>
      <dl className="mt-3 grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-on-surface-variant">{label}</dt>
            <dd className="truncate font-code-base text-on-surface" title={value}>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
