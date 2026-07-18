interface ComposerContextPanelProps {
  estimatedTokens: number;
  contextWindow?: number;
  usagePercent: number | null;
  onClose: () => void;
}

const CELL_COUNT = 20;

export function ComposerContextPanel(props: ComposerContextPanelProps) {
  const boundedPercent = Math.max(0, Math.min(100, props.usagePercent ?? 0));
  const filledCells = Math.ceil((boundedPercent / 100) * CELL_COUNT);
  const remaining = props.contextWindow === undefined
    ? undefined
    : Math.max(0, props.contextWindow - props.estimatedTokens);
  return (
    <div className="absolute inset-x-0 bottom-full z-20 mb-2 rounded-xl border border-outline-variant bg-surface p-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-ui-label-bold uppercase tracking-wide text-on-surface-variant">Context hiện tại</p>
          <p className="mt-1 text-xs text-on-surface">
            Ước tính {props.estimatedTokens.toLocaleString()} token
            {props.contextWindow ? ` / ${props.contextWindow.toLocaleString()}` : ' · chưa có giới hạn model'}
          </p>
        </div>
        <button type="button" onClick={props.onClose} className="px-2 text-xs text-on-surface-variant">Đóng</button>
      </div>
      <div className="mt-3 grid grid-cols-10 gap-1" role="meter" aria-label="Mức sử dụng context" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(boundedPercent)}>
        {Array.from({ length: CELL_COUNT }, (_, index) => (
          <span key={index} className={`h-5 rounded-sm ${index < filledCells ? contextCellColor(boundedPercent) : 'bg-surface-container-highest'}`} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-on-surface-variant">
        <span>{props.usagePercent === null ? 'Không xác định %' : `${boundedPercent.toFixed(1)}% đã dùng`}</span>
        <span>{remaining === undefined ? 'Cấu hình context window để tính phần còn lại' : `${remaining.toLocaleString()} token còn lại`}</span>
      </div>
    </div>
  );
}

function contextCellColor(percent: number) {
  if (percent >= 90) return 'bg-error';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-secondary';
}
