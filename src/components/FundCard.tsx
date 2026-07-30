import { Link } from "react-router-dom";
import clsx from "clsx";
import type { HoldingWithEstimate } from "@/types/fund";
import { formatPercent, formatMoney } from "@/lib/estimate";

function colorClass(v: number) {
  if (v > 0.005) return "text-orange-600";
  if (v < -0.005) return "text-green-600";
  return "text-gray-500";
}

export function FundCard({ holding }: { holding: HoldingWithEstimate }) {
  const dailyRate = holding.quote?.estimatedChangeRate ?? holding.estimate?.estimatedChangeRate ?? 0;
  const estNav = holding.quote?.estimatedNav ?? holding.estimate?.estimatedNav;
  const unitNav = holding.quote?.unitNav ?? holding.costPrice;
  const navDate = holding.quote?.navDate ?? "";

  const name = holding.quote?.name ?? holding.fundName;
  const indexName = holding.indexName ?? "";

  // 当日收益 = (估算净值 - 昨日净值) * 份额
  const dailyIncome = estNav !== undefined ? (estNav - unitNav) * holding.shares : 0;
  // 持有收益 = 持仓盈亏
  const holdingIncome = holding.profitLoss ?? 0;
  const holdingRate = holding.profitLossRate ?? 0;
  const marketValue = holding.currentValue ?? (estNav !== undefined ? estNav * holding.shares : 0);

  return (
    <Link
      to={`/fund/${holding.fundCode}`}
      className="block px-4 py-3 border-b border-gray-100 active:bg-gray-50 transition-colors"
    >
      {/* 第一行：基金名 + 市值 */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="font-medium text-[15px] text-gray-900 truncate flex-1">
          {name}
        </span>
        <span className="font-mono text-[15px] font-semibold tabular-nums shrink-0">
          ¥{formatMoney(marketValue)}
        </span>
      </div>

      {/* 第二行：meta + 当日收益 + 持有收益 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] text-gray-500 min-w-0 flex-1">
          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] leading-tight shrink-0">
            已更新
          </span>
          <span className="font-mono shrink-0 text-gray-700">{holding.fundCode}</span>
          {estNav !== undefined && (
            <span className="font-mono shrink-0 text-gray-500">
              {estNav.toFixed(4)}
            </span>
          )}
          {navDate && (
            <span className="text-gray-400 shrink-0 hidden sm:inline">{navDate.slice(5)}</span>
          )}
          {indexName && (
            <span className="truncate text-gray-500">{indexName}</span>
          )}
        </div>

        <div className="flex gap-3 shrink-0">
          <div className="text-right min-w-[58px]">
            <div className={clsx("font-mono text-xs font-semibold tabular-nums leading-tight", colorClass(dailyRate))}>
              {formatPercent(dailyRate)}
            </div>
            <div className="font-mono text-[11px] text-gray-500 tabular-nums leading-tight">
              {dailyIncome >= 0 ? "+" : ""}{formatMoney(dailyIncome)}
            </div>
          </div>

          <div className="text-right min-w-[58px]">
            <div className={clsx("font-mono text-xs font-semibold tabular-nums leading-tight", colorClass(holdingRate))}>
              {formatPercent(holdingRate)}
            </div>
            <div className="font-mono text-[11px] text-gray-500 tabular-nums leading-tight">
              {holdingIncome >= 0 ? "+" : ""}{formatMoney(holdingIncome)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}