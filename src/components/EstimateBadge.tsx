import clsx from "clsx";
import { formatPercent } from "@/lib/estimate";

interface Props {
  changeRate: number;
  estimatedNav: number;
  prevNav: number;
  estimateTime: string;
  coveredWeight?: number;
}

export function EstimateBadge({
  changeRate,
  estimatedNav,
  prevNav,
  estimateTime,
  coveredWeight
}: Props) {
  const isUp = changeRate > 0;
  const isFlat = Math.abs(changeRate) < 0.01;

  return (
    <div
      className={clsx(
        "rounded-2xl p-5 text-white",
        isFlat ? "bg-gray-500" : isUp ? "bg-orange-500" : "bg-green-600"
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className="text-sm opacity-90">估算净值</span>
        <span className="text-xs opacity-75">{estimateTime}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-3xl font-semibold tabular-nums">
          {estimatedNav.toFixed(4)}
        </span>
        <span className="text-lg font-medium tabular-nums">
          {formatPercent(changeRate)}
        </span>
      </div>
      <div className="mt-1 text-xs opacity-80">
        昨收 {prevNav.toFixed(4)}
        {coveredWeight !== undefined && ` · 持仓覆盖 ${(coveredWeight * 100).toFixed(1)}%`}
      </div>
    </div>
  );
}
