export type FundCode = string;

export interface FundInfo {
  code: string;
  name: string;
  type: string;
}

export interface FundNav {
  date: string;
  unitNav: number;
  accNav: number;
  growthRate: number;
}

export interface FundHolding {
  stockCode: string;
  stockName: string;
  weight: number;
  market: "SH" | "SZ" | "HK" | "US";
}

export interface StockQuote {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  market: "SH" | "SZ" | "HK" | "US";
}

export interface FundEstimate {
  code: string;
  name: string;
  prevNav: number;
  estimatedNav: number;
  estimatedChangeRate: number;
  estimateTime: string;
  holdings: FundHolding[];
  quotes: StockQuote[];
  coveredWeight: number;
}

export interface FundQuote {
  code: string;
  name: string;
  navDate: string;
  unitNav: number;
  estimatedNav: number;
  estimatedChangeRate: number;
  estimateTime: string;
}

export interface NavHistoryRow {
  date: string;
  unitNav: number;
  accNav: number;
  growthRate: number;
}

export interface Holding {
  id: string;
  fundCode: string;
  fundName: string;
  indexName?: string;
  shares: number;
  costPrice: number;
  addedAt: number;
}

export interface HoldingWithEstimate extends Holding {
  estimate?: FundEstimate;
  quote?: FundQuote;
  currentValue?: number;
  totalCost?: number;
  profitLoss?: number;
  profitLossRate?: number;
}
