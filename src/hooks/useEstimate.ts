import { useEffect, useState, useCallback } from "react";
import { getEstimate, getQuote, getBatchQuotes } from "@/lib/api";
import { computeEstimate, mergeHoldingWithQuote, formatPercent, formatMoney } from "@/lib/estimate";
import type { Holding, HoldingWithEstimate, FundEstimate, FundQuote } from "@/types/fund";

const REFRESH_INTERVAL = 60 * 1000;

export function useQuote(fundCode: string | null): {
  quote: FundQuote | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [quote, setQuote] = useState<FundQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!fundCode) return;
    setLoading(true);
    setError(null);
    try {
      const q = await getQuote(fundCode);
      setQuote(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [fundCode]);

  useEffect(() => {
    refresh();
    if (!fundCode) return;
    const timer = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [fundCode, refresh]);

  return { quote, loading, error, refresh };
}

export function useEstimate(fundCode: string | null): {
  estimate: FundEstimate | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [estimate, setEstimate] = useState<FundEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!fundCode) return;
    setLoading(true);
    setError(null);
    try {
      const e = await getEstimate(fundCode);
      setEstimate(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [fundCode]);

  useEffect(() => {
    refresh();
    if (!fundCode) return;
    const timer = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [fundCode, refresh]);

  return { estimate, loading, error, refresh };
}

export function useHoldingsWithEstimate(holdings: Holding[]): {
  data: HoldingWithEstimate[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [quotes, setQuotes] = useState<Map<string, FundQuote>>(new Map());
  const [estimates, setEstimates] = useState<Map<string, FundEstimate>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (holdings.length === 0) {
      setQuotes(new Map());
      setEstimates(new Map());
      return;
    }
    setLoading(true);
    setError(null);

    const codes = holdings.map((h) => h.fundCode);

    try {
      const batchResults = await getBatchQuotes(codes);
      const quoteMap = new Map<string, FundQuote>();
      const errors: string[] = [];
      batchResults.forEach((r) => {
        if (r.success && r.data) {
          quoteMap.set(r.code, r.data);
        } else if (r.error) {
          errors.push(`${r.code}: ${r.error}`);
        }
      });
      setQuotes(quoteMap);
      if (errors.length > 0) setError(errors.join("; "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "行情加载失败");
    } finally {
      setLoading(false);
    }

    // neodata 增强数据（可选，token 过期时静默失败）
    try {
      const estResults = await Promise.allSettled(
        holdings.map((h) => getEstimate(h.fundCode))
      );
      const estMap = new Map<string, FundEstimate>();
      estResults.forEach((r, i) => {
        if (r.status === "fulfilled") {
          estMap.set(holdings[i].fundCode, r.value);
        }
      });
      setEstimates(estMap);
    } catch {
      // neodata 不可用时不影响主功能
    }
  }, [holdings]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [refresh]);

  const data = holdings.map((h) => {
    const quote = quotes.get(h.fundCode);
    const estimate = estimates.get(h.fundCode);
    const merged = mergeHoldingWithQuote(h, quote);
    if (estimate) {
      merged.estimate = estimate;
    }
    return merged;
  });

  return { data, loading, error, refresh };
}

export { computeEstimate, formatPercent, formatMoney };
