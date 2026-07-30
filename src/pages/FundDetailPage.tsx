import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Pencil, Trash2, RefreshCw } from "lucide-react";
import { useHoldingsStore } from "@/store/holdingsStore";
import { useQuote, useEstimate } from "@/hooks/useEstimate";
import { EstimateBadge } from "@/components/EstimateBadge";
import { HoldingEditor } from "@/components/HoldingEditor";
import { formatPercent, formatMoney, formatTime } from "@/lib/estimate";
import clsx from "clsx";

export function FundDetailPage() {
  const { fundCode = "" } = useParams();
  const navigate = useNavigate();
  const { holdings, updateHolding, removeHolding } = useHoldingsStore();
  const holding = holdings.find((h) => h.fundCode === fundCode);

  const { quote, loading: quoteLoading, error: quoteError, refresh: refreshQuote } = useQuote(fundCode);
  const { estimate, loading: estLoading, refresh: refreshEst } = useEstimate(fundCode);
  const [editing, setEditing] = useState(false);

  const loading = quoteLoading || estLoading;
  const refresh = () => { refreshQuote(); refreshEst(); };

  if (!holding) {
    return (
      <div className="p-8 text-center text-gray-500">
        未找到该基金持仓
        <button onClick={() => navigate("/")} className="block mt-3 text-brand-500">
          返回首页
        </button>
      </div>
    );
  }

  const displayNav = quote?.estimatedNav ?? estimate?.estimatedNav;
  const displayRate = quote?.estimatedChangeRate ?? estimate?.estimatedChangeRate;
  const displayPrev = quote?.unitNav ?? estimate?.prevNav ?? 0;
  const displayTime = quote?.estimateTime ?? estimate?.estimateTime ?? "";
  const displayName = quote?.name ?? holding.fundName;

  return (
    <div className="min-h-full pb-16">
      <header className="bg-white border-b border-gray-100 px-3 py-2 flex items-center gap-2 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg active:bg-gray-100">
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{displayName}</div>
          <div className="text-xs text-gray-500 font-mono">{holding.fundCode}</div>
        </div>
        <button
          onClick={refresh}
          className="p-2 rounded-lg active:bg-gray-100"
          aria-label="刷新"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <main className="p-4 space-y-4">
        {displayNav ? (
          <EstimateBadge
            changeRate={displayRate ?? 0}
            estimatedNav={displayNav}
            prevNav={displayPrev}
            estimateTime={formatTime(displayTime)}
            coveredWeight={estimate?.coveredWeight}
          />
        ) : loading ? (
          <div className="card text-center text-gray-400 py-8">加载中...</div>
        ) : quoteError ? (
          <div className="card text-center text-red-500 py-8">{quoteError}</div>
        ) : null}

        {estimate && estimate.holdings.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-2 px-1">
              十大持仓贡献
            </h3>
            <div className="card divide-y divide-gray-100">
              {estimate.holdings.map((h) => {
                const q = estimate.quotes.find((x) => x.code === h.stockCode);
                const change = q?.changeRate ?? 0;
                const contribution = (h.weight * change).toFixed(2);
                return (
                  <div key={h.stockCode} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                      <span className="text-gray-700">{h.stockName}</span>
                      <span className="text-xs text-gray-400">
                        权重 {(h.weight * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-right">
                      <div
                        className={clsx(
                          "font-mono text-xs tabular-nums",
                          change > 0 ? "text-orange-600" : change < 0 ? "text-green-600" : "text-gray-400"
                        )}
                      >
                        {formatPercent(change)}
                      </div>
                      <div className="text-xs text-gray-400">
                        贡献 {Number(contribution) >= 0 ? "+" : ""}{contribution}bp
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-2 px-1">我的持仓</h3>
          <div className="card space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">份额</span>
              <span className="font-mono">{holding.shares}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">成本净值</span>
              <span className="font-mono">{holding.costPrice.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">总成本</span>
              <span className="font-mono">¥{formatMoney(holding.costPrice * holding.shares)}</span>
            </div>
            {displayNav && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">估算市值</span>
                  <span className="font-mono">¥{formatMoney(displayNav * holding.shares)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                  <span className="text-gray-500">估算盈亏</span>
                  <span
                    className={clsx(
                      "font-mono font-medium",
                      displayNav * holding.shares - holding.costPrice * holding.shares >= 0
                        ? "text-orange-600"
                        : "text-green-600"
                    )}
                  >
                    {displayNav * holding.shares - holding.costPrice * holding.shares >= 0 ? "+" : ""}
                    ¥{formatMoney(displayNav * holding.shares - holding.costPrice * holding.shares)}
                  </span>
                </div>
              </>
            )}
          </div>
        </section>

        <div className="flex gap-3">
          <button
            onClick={() => setEditing(true)}
            className="btn-ghost flex-1 flex items-center justify-center gap-1"
          >
            <Pencil size={16} /> 编辑
          </button>
          <button
            onClick={() => {
              if (confirm("确定删除该持仓？")) {
                removeHolding(holding.id);
                navigate("/");
              }
            }}
            className="flex-1 bg-red-50 text-red-600 rounded-xl py-3 font-medium active:bg-red-100 flex items-center justify-center gap-1"
          >
            <Trash2 size={16} /> 删除
          </button>
        </div>
      </main>

      {editing && (
        <HoldingEditor
          fundCode={holding.fundCode}
          fundName={holding.fundName}
          initial={holding}
          onSave={(data) => {
            updateHolding(holding.id, data);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}
