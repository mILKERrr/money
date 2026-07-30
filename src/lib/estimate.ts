import type {
  FundEstimate,
  FundHolding,
  FundQuote,
  Holding,
  HoldingWithEstimate,
  StockQuote
} from "@/types/fund";

export function computeEstimate(
  prevNav: number,
  holdings: FundHolding[],
  quotes: StockQuote[]
): { estimatedNav: number; estimatedChangeRate: number; coveredWeight: number } {
  if (!prevNav || holdings.length === 0) {
    return { estimatedNav: prevNav, estimatedChangeRate: 0, coveredWeight: 0 };
  }

  const quoteMap = new Map<string, StockQuote>();
  quotes.forEach((q) => quoteMap.set(q.code, q));

  let weightedReturn = 0;
  let coveredWeight = 0;

  for (const h of holdings) {
    const q = quoteMap.get(h.stockCode);
    if (!q || q.changeRate === null || q.changeRate === undefined) continue;
    weightedReturn += h.weight * (q.changeRate / 100);
    coveredWeight += h.weight;
  }

  const uncoveredWeight = Math.max(0, 1 - coveredWeight);
  if (uncoveredWeight > 0) {
    weightedReturn += uncoveredWeight * (weightedReturn / Math.max(coveredWeight, 0.0001));
  }

  const estimatedChangeRate = weightedReturn * 100;
  const estimatedNav = prevNav * (1 + weightedReturn);

  return { estimatedNav, estimatedChangeRate, coveredWeight };
}

export function mergeHoldingWithQuote(
  holding: Holding,
  quote?: FundQuote
): HoldingWithEstimate {
  const result: HoldingWithEstimate = { ...holding };

  if (quote) {
    result.quote = quote;
    const nav = quote.estimatedNav;
    result.currentValue = nav * holding.shares;
    result.totalCost = holding.costPrice * holding.shares;
    result.profitLoss = result.currentValue - result.totalCost;
    result.profitLossRate = result.totalCost > 0
      ? result.profitLoss / result.totalCost
      : 0;
  }

  return result;
}

export function mergeHoldingWithEstimate(
  holding: Holding,
  estimate?: FundEstimate
): HoldingWithEstimate {
  const result: HoldingWithEstimate = { ...holding };

  if (estimate) {
    result.estimate = estimate;
    const nav = estimate.estimatedNav;
    result.currentValue = nav * holding.shares;
    result.totalCost = holding.costPrice * holding.shares;
    result.profitLoss = result.currentValue - result.totalCost;
    result.profitLossRate = result.totalCost > 0
      ? result.profitLoss / result.totalCost
      : 0;
  }

  return result;
}

export function formatPercent(v: number, digits = 2): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

export function formatMoney(v: number): string {
  return v.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}
