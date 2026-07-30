import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Moon, RefreshCw, Grid3x3, ListChecks } from "lucide-react";
import { useHoldingsStore } from "@/store/holdingsStore";
import { useHoldingsWithEstimate } from "@/hooks/useEstimate";
import { FundCard } from "@/components/FundCard";
import { formatMoney } from "@/lib/estimate";
import clsx from "clsx";

type Tab = "summary" | "all";

export function HomePage() {
  const navigate = useNavigate();
  const holdings = useHoldingsStore((s) => s.holdings);
  const loadDefaultHoldings = useHoldingsStore((s) => s.loadDefaultHoldings);
  const { data, loading, refresh } = useHoldingsWithEstimate(holdings);
  const [tab, setTab] = useState<Tab>("all");

  useEffect(() => {
    if (holdings.length === 0) {
      loadDefaultHoldings();
    }
  }, [holdings.length, loadDefaultHoldings]);

  const totalCost = data.reduce(
    (sum, h) => sum + (h.totalCost ?? 0),
    0
  );

  // 当日总收益 = sum of (estimatedNav - unitNav) * shares
  const totalDailyProfit = data.reduce((sum, h) => {
    if (!h.quote) return sum;
    const diff = (h.quote.estimatedNav - h.quote.unitNav) * h.shares;
    return sum + diff;
  }, 0);

  // 模拟指数数据（实际可接 /api/index/sh000001）
  const shIndex = { name: "上证指数", value: 3804.69, change: -0.62 };

  const today = "07-30";

  return (
    <div className="min-h-full pb-32 bg-white">
      {/* 顶部栏：图标 + 搜索 + 美股夜盘 */}
      <header className="flex items-center justify-between px-4 pt-2 pb-1.5 bg-white">
        <button className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-lg shrink-0" aria-label="行情">
          🍉
        </button>
        <div className="flex items-center gap-2 flex-1 justify-center">
          <button className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" aria-label="深色模式">
            <Moon size={16} className="text-gray-500" />
          </button>
          <button
            onClick={() => navigate("/add")}
            className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-gray-100 text-sm text-gray-600"
            aria-label="搜索"
          >
            <Search size={14} />
            <span>搜索</span>
          </button>
        </div>
        <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-600 text-[11px] font-medium shrink-0">
          美股夜盘
        </span>
      </header>

      {/* 指数 + 当日总收益 */}
      <section className="mx-4 mt-2 mb-3 flex items-end justify-between">
        <button className="text-left">
          <div className="flex items-center gap-1 text-sm text-gray-700">
            <span className="font-medium">{shIndex.name}</span>
            <span className="text-gray-400 text-[10px]">▼</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums">{shIndex.value.toFixed(2)}</span>
            <span className={clsx("font-mono text-sm tabular-nums", colorClass(shIndex.change / 100))}>
              {shIndex.change.toFixed(2)}%
            </span>
          </div>
        </button>
        <div className="text-right">
          <div className="text-xs text-gray-500">当日总收益</div>
          <div className={clsx("mt-1 font-mono text-2xl font-semibold tabular-nums", colorClass(totalDailyProfit / Math.max(totalCost, 1)))}>
            {totalDailyProfit >= 0 ? "+" : ""}{formatMoney(totalDailyProfit)}
          </div>
        </div>
      </section>

      {/* Tab 导航 */}
      <div className="flex items-center justify-between px-4 border-b border-gray-100">
        <div className="flex items-center gap-5">
          <button
            onClick={() => setTab("summary")}
            className={clsx(
              "py-2.5 text-sm relative",
              tab === "summary" ? "text-gray-900 font-medium" : "text-gray-500"
            )}
          >
            汇总
            {tab === "summary" && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-gray-900 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setTab("all")}
            className={clsx(
              "py-2.5 text-sm relative flex items-center gap-1",
              tab === "all" ? "text-gray-900 font-medium" : "text-gray-500"
            )}
          >
            全部
            {tab === "all" && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-gray-900 rounded-full" />
            )}
          </button>
          <button
            onClick={() => navigate("/add")}
            className="py-2.5 text-sm text-gray-400"
            aria-label="添加"
          >
            <Plus size={16} />
          </button>
        </div>
        <button className="p-2 text-gray-500" aria-label="视图切换">
          <Grid3x3 size={18} />
        </button>
      </div>

      {/* 列标题 */}
      {data.length > 0 && (
        <div className="flex items-center px-4 py-2 text-[11px] text-gray-400 bg-gray-50/60 border-b border-gray-100">
          <span className="flex-1 min-w-0">基金 / {holdings.length} 只</span>
          <div className="flex gap-3 shrink-0">
            <span className="text-right min-w-[58px]">估算净值<br />{today}</span>
            <span className="text-right min-w-[58px]">当日收益<br />{today}</span>
            <span className="text-right min-w-[58px]">持有收益<br />{today}</span>
          </div>
        </div>
      )}

      {/* 基金列表 */}
      <main>
        {data.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">还没有持仓，添加一只基金开始</p>
            <button
              onClick={() => navigate("/add")}
              className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm"
            >
              添加基金
            </button>
          </div>
        ) : (
          <div>
            {data.map((h) => <FundCard key={h.id} holding={h} />)}
          </div>
        )}
      </main>

      {/* 底部操作栏 */}
      <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-4 py-2 bg-white border-t border-gray-100 flex gap-3 z-10">
        <button
          onClick={() => navigate("/add")}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-gray-100 text-sm text-gray-700 active:bg-gray-200"
        >
          <Plus size={16} />
          新增持有
        </button>
        <button
          onClick={refresh}
          className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-xl bg-gray-100 text-sm text-gray-700 active:bg-gray-200"
        >
          <ListChecks size={16} />
          批量加减仓
        </button>
      </div>

      {/* 刷新指示器 */}
      {loading && (
        <div className="fixed top-1 left-1/2 -translate-x-1/2 z-20">
          <div className="px-3 py-1 rounded-full bg-brand-500 text-white text-xs flex items-center gap-1.5 shadow">
            <RefreshCw size={12} className="animate-spin" />
            刷新中
          </div>
        </div>
      )}
    </div>
  );
}

function colorClass(v: number) {
  if (v > 0.005) return "text-orange-600";
  if (v < -0.005) return "text-green-600";
  return "text-gray-500";
}