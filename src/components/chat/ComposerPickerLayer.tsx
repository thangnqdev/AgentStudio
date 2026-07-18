import type { AIModel, PermissionMode } from '../../domain/entities/settings';
import { ComposerContextPanel } from './ComposerContextPanel';
import { ComposerHooksPanel } from './ComposerHooksPanel';
import { ComposerCompactDialog } from './ComposerCompactDialog';
import { ComposerQuickPicker, type ComposerQuickPickerItem } from './ComposerQuickPicker';
import { ComposerRenameDialog } from './ComposerRenameDialog';
import { ComposerResumableTaskPicker } from './ComposerResumableTaskPicker';
import { ComposerStatusPanel } from './ComposerStatusPanel';

export type ComposerPickerKind = 'model' | 'permission' | 'resume' | 'rename' | 'context' | 'status' | 'hooks' | 'compact';

const PERMISSION_ITEMS: ComposerQuickPickerItem[] = [
  { value: 'read-only', label: 'read-only', description: 'Chỉ khảo sát; không sửa file hoặc chạy lệnh.' },
  { value: 'workspace-write', label: 'workspace-write', description: 'Cho phép sửa và chạy lệnh trong workspace sandbox.' },
  { value: 'danger-full-access', label: 'danger-full-access', description: 'Toàn quyền trên máy; chỉ dùng cho workspace đáng tin cậy.' },
];

interface ComposerPickerLayerProps {
  active: ComposerPickerKind | null;
  models: AIModel[];
  activeModelId: string | null;
  permissionMode: PermissionMode;
  currentThreadTitle: string;
  estimatedTokens: number;
  contextWindow?: number;
  contextUsagePercent: number | null;
  providerName?: string;
  fallbackModelId: string | null;
  workspacePath: string;
  currentBranch: string | null;
  onModelSelect: (modelId: string) => Promise<void>;
  onPermissionSelect: (mode: PermissionMode) => Promise<void>;
  onResume: (taskId: string) => void;
  onRename: (title: string) => void;
  onClose: () => void;
}

export function ComposerPickerLayer(props: ComposerPickerLayerProps) {
  if (props.active === 'resume') {
    return <ComposerResumableTaskPicker active onSelect={(taskId) => { props.onClose(); props.onResume(taskId); }} onClose={props.onClose} />;
  }
  if (props.active === 'rename') {
    return <ComposerRenameDialog currentTitle={props.currentThreadTitle} onRename={props.onRename} onClose={props.onClose} />;
  }
  if (props.active === 'context') {
    return <ComposerContextPanel estimatedTokens={props.estimatedTokens} contextWindow={props.contextWindow} usagePercent={props.contextUsagePercent} onClose={props.onClose} />;
  }
  if (props.active === 'status') {
    return <ComposerStatusPanel providerName={props.providerName} activeModelId={props.activeModelId} fallbackModelId={props.fallbackModelId} permissionMode={props.permissionMode} workspacePath={props.workspacePath} currentBranch={props.currentBranch} onClose={props.onClose} />;
  }
  if (props.active === 'hooks') return <ComposerHooksPanel onClose={props.onClose} />;
  if (props.active === 'compact') return <ComposerCompactDialog onClose={props.onClose} />;
  if (!props.active) return null;

  const modelPicker = props.active === 'model';
  const items = modelPicker
    ? props.models.map((model) => ({ value: model.id, label: model.id, description: model.contextWindow ? `Context ${model.contextWindow.toLocaleString()} tokens` : undefined }))
    : PERMISSION_ITEMS;
  const select = async (value: string) => {
    if (modelPicker) await props.onModelSelect(value);
    else await props.onPermissionSelect(value as PermissionMode);
    props.onClose();
  };
  return (
    <ComposerQuickPicker
      title={modelPicker ? 'Chọn model' : 'Chọn chế độ quyền'}
      items={items}
      selectedValue={modelPicker ? props.activeModelId : props.permissionMode}
      onSelect={(value) => void select(value)}
      onClose={props.onClose}
    />
  );
}
