import { useAppVersion } from '../../application/hooks/useAppVersion';
import type { PermissionMode } from '../../domain/entities/settings';
import { permissionModeLabel } from '../../application/services/agentDisplay';

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
    ['Nhà cung cấp', props.providerName ?? 'chưa cấu hình'],
    ['Model', props.activeModelId ?? 'chưa chọn'],
    ['Dự phòng', props.fallbackModelId ?? 'không dùng'],
    ['Quyền', permissionModeLabel(props.permissionMode)],
    ['Dự án', props.workspacePath || 'chưa chọn'],
    ['Nhánh Git', props.currentBranch ?? 'không có Git'],
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
