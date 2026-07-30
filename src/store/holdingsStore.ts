import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Holding } from "@/types/fund";

interface HoldingsState {
  holdings: Holding[];
  hasLoadedDefaults: boolean;
  addHolding: (h: Omit<Holding, "id" | "addedAt">) => void;
  updateHolding: (id: string, patch: Partial<Omit<Holding, "id">>) => void;
  removeHolding: (id: string) => void;
  clearAll: () => void;
  loadDefaultHoldings: () => void;
}

const DEFAULT_HOLDINGS: Omit<Holding, "id" | "addedAt">[] = [
  { fundCode: "510300", fundName: "天弘沪深300ETF联接", indexName: "沪深300", shares: 17000, costPrice: 3.40 },
  { fundCode: "513050", fundName: "易方达中证海外互联ETF", indexName: "中概互联", shares: 41000, costPrice: 1.22 },
  { fundCode: "512890", fundName: "华泰柏瑞中证红利低波ETF", indexName: "红利低波", shares: 28000, costPrice: 1.38 },
  { fundCode: "161725", fundName: "招商中证白酒指数(LOF)A", indexName: "白酒", shares: 33000, costPrice: 1.00 },
  { fundCode: "515790", fundName: "华夏中证光伏产业ETF联接A", indexName: "光伏", shares: 25000, costPrice: 0.72 },
  { fundCode: "512480", fundName: "华夏国证半导体芯片ETF联接A", indexName: "国证芯片", shares: 7300, costPrice: 0.64 },
  { fundCode: "011612", fundName: "华夏科创50ETF联接A", indexName: "科创50", shares: 1000, costPrice: 0.85 },
];

export const useHoldingsStore = create<HoldingsState>()(
  persist(
    (set, get) => ({
      holdings: [],
      hasLoadedDefaults: false,
      addHolding: (h) =>
        set((s) => ({
          holdings: [
            ...s.holdings,
            { ...h, id: crypto.randomUUID(), addedAt: Date.now() }
          ]
        })),
      updateHolding: (id, patch) =>
        set((s) => ({
          holdings: s.holdings.map((h) =>
            h.id === id ? { ...h, ...patch } : h
          )
        })),
      removeHolding: (id) =>
        set((s) => ({ holdings: s.holdings.filter((h) => h.id !== id) })),
      clearAll: () => set({ holdings: [], hasLoadedDefaults: false }),
      loadDefaultHoldings: () => {
        if (get().hasLoadedDefaults || get().holdings.length > 0) return;
        const holdings = DEFAULT_HOLDINGS.map((h, i) => ({
          ...h,
          id: `default-${i}`,
          addedAt: Date.now() - (DEFAULT_HOLDINGS.length - i) * 86400000
        }));
        set({ holdings, hasLoadedDefaults: true });
      }
    }),
    { name: "fund-estimator-holdings" }
  )
);
