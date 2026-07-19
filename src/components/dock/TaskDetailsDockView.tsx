import { useAppStore } from '../../store/useAppStore';
import { permissionModeLabel } from '../../application/services/agentDisplay';

export function TaskDetailsDockView() {
  const projectPath = useAppStore((state) => state.projectPath);
  const currentBranch = useAppStore((state) => state.currentBranch);
  const settings = useAppStore((state) => state.settings);
  const activeTask = useAppStore((state) => state.activeTask);
  return (
    <div className="flex-1 overflow-y-auto bg-white p-4">
      <h3 className="text-[13px] font-semibold text-[#292929]">Chi tiết tác vụ</h3>
      <p className="mt-1 text-[10px] text-[#888]">Thông tin agent đang dùng để làm việc</p>
      <div className="mt-4 space-y-2">
        <Detail icon="chat_bubble" label="Tác vụ" value={activeTask || 'Tác vụ mới'} />
        <Detail icon="folder" label="Dự án" value={basename(projectPath) || 'Chưa chọn'} title={projectPath ?? undefined} />
        <Detail icon="account_tree" label="Nhánh" value={currentBranch || 'Không dùng Git'} />
        <Detail icon="shield" label="Quyền truy cập" value={permissionModeLabel(settings.permissionMode)} />
      </div>
      <details className="mt-5 rounded-lg border border-black/[0.07] bg-[#fafafa]">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-[11px] font-medium text-[#666]">Thông tin kỹ thuật</summary>
        <div className="space-y-2 border-t border-black/[0.06] px-3 py-3 font-mono text-[9px] text-[#777]">
          <p className="break-all">{projectPath || 'workspace: —'}</p>
          <p>permission: {settings.permissionMode}</p>
          <p>model: {settings.activeModelId || '—'}</p>
        </div>
      </details>
    </div>
  );
}

function Detail({ icon, label, value, title }: { icon: string; label: string; value: string; title?: string }) {
  return <div className="flex items-start gap-3 rounded-lg border border-black/[0.07] px-3 py-2.5"><span className="material-symbols-outlined mt-0.5 text-[16px] text-[#777]">{icon}</span><div className="min-w-0"><p className="text-[9px] uppercase tracking-wide text-[#999]">{label}</p><p className="mt-0.5 truncate text-[11px] text-[#333]" title={title ?? value}>{value}</p></div></div>;
}
function basename(path: string | null) { return path?.split(/[\\/]/).filter(Boolean).pop() ?? ''; }
