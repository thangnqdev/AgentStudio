import { useAppStore } from '../../store/useAppStore';

export function WorktreeBanner() {
  const worktree = useAppStore((state) => state.worktreeState);
  if (!worktree.active) return null;
  const label = worktree.branch || worktree.path?.split(/[\\/]/).filter(Boolean).at(-1) || 'isolated';
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#2f7d5c]/40 bg-[#2f7d5c]/10 px-3 py-2 text-[12px] text-primary" role="status">
      <span className="material-symbols-outlined text-[17px] text-[#2f7d5c]">account_tree</span>
      <span className="font-ui-label-bold">WORKTREE</span>
      <span className="truncate text-on-surface-variant" title={worktree.path}>{label} · mọi tool đang chạy trong workspace cô lập.</span>
    </div>
  );
}
