import { useAppStore } from '../../store/useAppStore';

export function PlanModeBanner() {
  const active = useAppStore((state) => state.planModeActive);
  if (!active) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-[12px] text-primary" role="status">
      <span className="material-symbols-outlined text-[17px] text-info">edit_note</span>
      <span className="font-ui-label-bold">PLAN MODE</span>
      <span className="text-on-surface-variant">Chỉ khám phá và lập kế hoạch; thay đổi code đang bị khóa.</span>
    </div>
  );
}
