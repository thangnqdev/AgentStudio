import { getContextUsageTone } from '../../application/services/tokenEstimator';

interface TokenProgressRingProps {
  percent: number;
}

export function TokenProgressRing({ percent }: TokenProgressRingProps) {
  const tone = getContextUsageTone(percent);
  const strokeDashoffset = 44 - (Math.min(percent, 100) / 100) * 44;

  return (
    <div className={`flex items-center gap-1.5 ${tone.text}`}>
      <span className="text-[10px] font-ui-label-bold tabular-nums whitespace-nowrap">
        ~{percent}%
      </span>
      <div className="relative w-[18px] h-[18px] flex items-center justify-center">
        <svg className="w-[18px] h-[18px] transform -rotate-90">
          <circle
            cx="9"
            cy="9"
            r="7"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            className="text-outline-variant/40"
          />
          <circle
            cx="9"
            cy="9"
            r="7"
            stroke="currentColor"
            strokeWidth="2.5"
            fill="none"
            strokeDasharray="44"
            strokeDashoffset={strokeDashoffset}
            className={tone.stroke}
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
