import type {
  FundInfo,
  FundNav,
  FundHolding,
  FundEstimate,
  FundQuote,
  NavHistoryRow
} from "@/types/fund";

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: "application/json" }
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  if (json.code !== "200" || !json.suc) {
    throw new Error(json.msg ?? "服务返回异常");
  }
  return json.data as T;
}

export interface SearchResponse {
  entities: { code: string; name: string; type?: string }[];
}

export async function searchFund(keyword: string): Promise<FundInfo[]> {
  const data = await request<SearchResponse>(
    `/search?q=${encodeURIComponent(keyword)}`
  );
  return (data.entities ?? []).map((e) => ({
    code: e.code,
    name: e.name,
    type: e.type ?? "fund"
  }));
}

export interface FundDetailResponse {
  code: string;
  name: string;
  latestNav: FundNav | null;
  navHistory: FundNav[];
  holdings: FundHolding[];
}

export async function getFundDetail(code: string): Promise<FundDetailResponse> {
  return request<FundDetailResponse>(`/fund/${code}`);
}

export interface EstimateResponse {
  estimate: FundEstimate;
}

export async function getEstimate(code: string): Promise<FundEstimate> {
  const data = await request<EstimateResponse>(`/estimate/${code}`);
  return data.estimate;
}

export async function getQuote(code: string): Promise<FundQuote> {
  return request<FundQuote>(`/quote/${code}`);
}

export interface BatchQuoteItem {
  code: string;
  success: boolean;
  data: FundQuote | null;
  error: string | null;
}

export async function getBatchQuotes(codes: string[]): Promise<BatchQuoteItem[]> {
  if (codes.length === 0) return [];
  return request<BatchQuoteItem[]>(`/quotes?codes=${codes.join(",")}`);
}

export interface NavHistoryResponse {
  list: NavHistoryRow[];
  total: number;
}

export async function getNavHistory(code: string, size?: number): Promise<NavHistoryResponse> {
  const param = size ? `?size=${size}` : "";
  return request<NavHistoryResponse>(`/nav-history/${code}${param}`);
}
