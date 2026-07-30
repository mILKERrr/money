/**
 * Cloudflare Worker — neodata API 代理
 *
 * 路由：
 *   GET  /api/health                 健康检查
 *   GET  /api/search?q=<kw>          搜索基金
 *   GET  /api/fund/:code             基金详情（净值历史 + 前十大持仓）
 *   GET  /api/estimate/:code         盘中实时估值（聚合多查询）
 *   POST /api/admin/update-token     热更新 token（body: { token, admin_key }）
 *   GET  /api/admin/token-status     查看当前 token 状态（是否已注入、是否过期）
 *
 * Token 策略：
 *   - 优先级：KV → 内存变量 → 环境变量 NEODATA_TOKEN
 *   - 写入：admin 接口调用 → 同时写 KV（如果配了）和内存
 *   - 生产环境（多实例）必须配 TOKEN_KV，本地 dev 可不配只用内存
 */

const NEODATA_URL = "https://copilot.tencent.com/agenttool/v1/neodata";

interface Env {
  NEODATA_TOKEN: string;        // 初始 token（wrangler secret 或 .dev.vars 注入）
  ADMIN_KEY: string;             // admin 接口鉴权密钥
  TOKEN_KV?: KVNamespace;        // 可选，生产环境持久化 token 用
}

// 模块级 token 缓存（单实例内有效，多实例需靠 KV 同步）
let memoryToken: string | null = null;

async function getToken(env: Env): Promise<string> {
  // 1. KV 优先（多实例同步用）
  if (env.TOKEN_KV) {
    const kvToken = await env.TOKEN_KV.get("neodata_token");
    if (kvToken) {
      memoryToken = kvToken; // 同步到内存
      return kvToken;
    }
  }
  // 2. 内存缓存
  if (memoryToken) return memoryToken;
  // 3. 环境变量（启动时注入的初始 token）
  if (env.NEODATA_TOKEN) {
    memoryToken = env.NEODATA_TOKEN;
    return env.NEODATA_TOKEN;
  }
  throw new Error("TOKEN_MISSING");
}

async function setToken(env: Env, token: string): Promise<void> {
  memoryToken = token;
  if (env.TOKEN_KV) {
    await env.TOKEN_KV.put("neodata_token", token);
  }
}

interface NeodataResp {
  code: string;
  suc: boolean;
  msg?: string;
  data?: {
    apiData?: {
      entity?: { code: string; name: string }[];
      apiRecall?: {
        type: string;
        tag?: string;
        content: string;
        desc?: string;
      }[];
    };
    docData?: any;
  };
}

async function callNeodata(token: string, query: string, dataType?: "api" | "doc" | "all") {
  const body: Record<string, string> = {
    query,
    channel: "neodata",
    sub_channel: "workbuddy"
  };
  if (dataType) body.data_type = dataType;

  const res = await fetch(NEODATA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });

  if (res.status === 401 || res.status === 403) {
    // token 失效，清空内存缓存，下次请求会重新从 KV/环境变量读
    memoryToken = null;
    throw new Error("TOKEN_EXPIRED");
  }
  if (!res.ok) {
    throw new Error(`neodata ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as NeodataResp;
  if (json.code !== "200" || !json.suc) {
    // neodata 自己的鉴权失败码
    if (json.code === "40101" || (json.msg ?? "").includes("token") || (json.msg ?? "").includes("鉴权")) {
      memoryToken = null;
      throw new Error("TOKEN_EXPIRED");
    }
    throw new Error(json.msg ?? "neodata returned error");
  }
  return json.data;
}

function jsonResp(body: unknown, status = 200, extra?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store",
      ...extra
    }
  });
}

function errorResp(message: string, status = 500) {
  return jsonResp({ code: status.toString(), suc: false, msg: message }, status);
}

const CORS_PREFLIGHT = new Response(null, {
  status: 204,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  }
});

function parseMarkdownTable(content: string): Record<string, string>[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const splitRow = (row: string) => {
    if (!row.startsWith("|")) return [];
    return row
      .slice(1, row.endsWith("|") ? -1 : undefined)
      .split("|")
      .map((c) => c.trim());
  };

  // neodata 返回的 content 头部常有 **基金代码**: xxx 这种 bold 文本，表格行不一定是 lines[0]
  // 找到第一个以 | 开头的行作为表头
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("|")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const headers = splitRow(lines[headerIdx]).map((h) =>
    h.replace(/[()（）].*$/, "").trim()
  );
  const rows: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    if (/^\|[\s:|-]+\|?$/.test(lines[i])) continue;
    const cells = splitRow(lines[i]);
    if (cells.length === 0) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

interface FundSearchHit {
  code: string;
  name: string;
  type?: string;
}

async function searchFund(token: string, keyword: string): Promise<FundSearchHit[]> {
  const data = await callNeodata(token, `${keyword} 基金`, "api");
  const entities = data?.apiData?.entity ?? [];
  return entities.map((e) => {
    // neodata 返回的 entity 字段是反的：code 字段实际放的是中文名，name 字段才是 "161725.JJ"
    const rawName = e.name ?? "";
    const m = rawName.match(/^(\d{6})\.(JJ|OF|SZ|SH|HK|US)$/i);
    const code = m ? m[1] : rawName;
    const name = e.code ?? rawName;
    return {
      code,
      name,
      type: "fund"
    };
  });
}

interface FundHoldingRow {
  stockCode: string;
  stockName: string;
  weight: number;
  market: "SH" | "SZ" | "HK" | "US";
}

interface FundNavRow {
  date: string;
  unitNav: number;
  accNav: number;
  growthRate: number;
}

interface FundDetail {
  code: string;
  name: string;
  latestNav: FundNavRow | null;
  navHistory: FundNavRow[];
  holdings: FundHoldingRow[];
}

function parseFundCode(raw: string): { of: string; exchange?: string } {
  const m = raw.match(/^(\d{6})\.(OF|SZ|SH|HK|US)$/i);
  if (!m) return { of: raw };
  const code = m[1];
  const ex = m[2].toUpperCase();
  if (ex === "OF") return { of: `${code}.OF` };
  return { of: `${code}.OF`, exchange: `${code}.${ex}` };
}

async function getFundDetail(token: string, code: string): Promise<FundDetail> {
  // 并行查询净值和持仓，避免单次合并查询关键词被 neodata 拒识
  const [navData, holdData] = await Promise.all([
    callNeodata(token, `${code} 基金净值`, "api"),
    callNeodata(token, `${code} 基金重仓股票 持仓`, "api")
  ]);

  const navRecall = navData?.apiData?.apiRecall ?? [];
  const holdRecall = holdData?.apiData?.apiRecall ?? [];
  // neodata 的 entity 字段是反的：code 字段放中文名，name 字段放 "161725.SZ"
  const navEntities = navData?.apiData?.entity ?? [];
  const holdEntities = holdData?.apiData?.entity ?? [];
  const cnName = navEntities[0]?.code ?? holdEntities[0]?.code ?? code;

  let navHistory: FundNavRow[] = [];
  let holdings: FundHoldingRow[] = [];

  for (const r of navRecall) {
    if (r.type?.includes("净值") || r.desc?.includes("净值")) {
      const rows = parseMarkdownTable(r.content);
      navHistory = rows
        .map((row) => {
          const date = row["交易日期"] ?? row["日期"] ?? "";
          const unitNav = parseFloat(row["单位净值"] ?? row["单位净值(元)"] ?? "0");
          const accNav = parseFloat(row["单位累计净值"] ?? row["单位累计净值(元)"] ?? "0");
          const growth = parseFloat(row["复权单位净值日增长率"] ?? row["日增长率"] ?? "0");
          if (!date || !unitNav) return null;
          return { date, unitNav, accNav, growthRate: growth };
        })
        .filter((x): x is FundNavRow => x !== null);
    }
  }

  for (const r of holdRecall) {
    if (
      r.type?.includes("重仓") ||
      r.desc?.includes("重仓") ||
      r.type?.includes("持仓") ||
      r.type?.includes("资产")
    ) {
      const rows = parseMarkdownTable(r.content);
      const parsed = rows
        .map((row) => {
          const stockCode = row["股票代码"] ?? "";
          const stockName = row["股票名称"] ?? "";
          const weightStr = row["持仓比例"] ?? row["持仓比例(%)"] ?? "0";
          // neodata 返回的持仓比例已经是小数（如 0.1728 表示 17.28%），不要除以 100
          const weight = parseFloat(weightStr);
          if (!stockCode || !weight) return null;
          const m = stockCode.match(/\.(SH|SZ|HK|US)$/i);
          const market = (m?.[1]?.toUpperCase() ?? "SH") as "SH" | "SZ" | "HK" | "US";
          return { stockCode, stockName, weight, market };
        })
        .filter((x): x is FundHoldingRow => x !== null);
      if (parsed.length > 0) {
        holdings = parsed;
        break;
      }
    }
  }

  const latestNav = navHistory.length > 0 ? navHistory[0] : null;

  return { code, name: cnName, latestNav, navHistory, holdings };
}

interface StockQuote {
  code: string;
  name: string;
  price: number;
  changeRate: number;
  market: "SH" | "SZ" | "HK" | "US";
}

async function getQuotes(token: string, codes: string[]): Promise<StockQuote[]> {
  if (codes.length === 0) return [];

  // neodata 单股实时行情返回的是自然语言文本（不是 markdown 表格），格式如：
  //   贵州茅台(代码:600519.SH)在A股股票的行情：
  //   数据更新时间:2026/07/24 16:14:33;最新价格:1,297.41元;...;当日涨跌幅:0.42%;...
  // 多股批量查询不可靠，所以每只股票单独查，并行加速
  const tasks = codes.map(async (code) => {
    try {
      const data = await callNeodata(token, `${code} 股票实时行情`, "api");
      const recall = data?.apiData?.apiRecall ?? [];
      for (const r of recall) {
        if (!r.type?.includes("行情") && !r.desc?.includes("行情")) continue;
        const content = r.content ?? "";
        const priceMatch = content.match(/最新价格:([\d,]+(?:\.\d+)?)元/);
        const changeMatch = content.match(/当日涨跌幅:(-?[\d.]+)%/);
        if (!priceMatch) continue;
        const price = parseFloat(priceMatch[1].replace(/,/g, ""));
        const changeRate = changeMatch ? parseFloat(changeMatch[1]) : 0;
        const m = code.match(/\.(SH|SZ|HK|US)$/i);
        const market = (m?.[1]?.toUpperCase() ?? "SH") as "SH" | "SZ" | "HK" | "US";
        // 提取股票中文名（content 第一行的"贵州茅台(代码..."）
        const nameMatch = content.match(/^([^\n(（]+?)(?:\(|（)/);
        const name = nameMatch ? nameMatch[1].trim() : code;
        return { code, name, price, changeRate, market } as StockQuote;
      }
      return null;
    } catch (err) {
      console.error(`quote failed for ${code}:`, err);
      return null;
    }
  });

  const settled = await Promise.all(tasks);
  return settled.filter((x): x is StockQuote => x !== null);
}

function computeEstimate(
  prevNav: number,
  holdings: FundHoldingRow[],
  quotes: StockQuote[]
): { estimatedNav: number; estimatedChangeRate: number; coveredWeight: number } {
  if (!prevNav || holdings.length === 0) {
    return { estimatedNav: prevNav, estimatedChangeRate: 0, coveredWeight: 0 };
  }

  const quoteMap = new Map(quotes.map((q) => [q.code, q]));
  let weightedReturn = 0;
  let coveredWeight = 0;

  for (const h of holdings) {
    const q = quoteMap.get(h.stockCode);
    if (!q || !q.changeRate) continue;
    weightedReturn += h.weight * (q.changeRate / 100);
    coveredWeight += h.weight;
  }

  const uncoveredWeight = Math.max(0, 1 - coveredWeight);
  if (uncoveredWeight > 0 && coveredWeight > 0) {
    weightedReturn += uncoveredWeight * (weightedReturn / coveredWeight);
  }

  return {
    estimatedNav: prevNav * (1 + weightedReturn),
    estimatedChangeRate: weightedReturn * 100,
    coveredWeight
  };
}

async function handleEstimate(token: string, code: string) {
  const detail = await getFundDetail(token, code);
  if (!detail.latestNav) {
    throw new Error("无法获取基金净值");
  }

  const prevNav = detail.latestNav.unitNav;
  const stockCodes = detail.holdings.map((h) => h.stockCode);
  const quotes = await getQuotes(token, stockCodes);

  const { estimatedNav, estimatedChangeRate, coveredWeight } = computeEstimate(
    prevNav,
    detail.holdings,
    quotes
  );

  return {
    estimate: {
      code,
      name: detail.name,
      prevNav,
      estimatedNav,
      estimatedChangeRate,
      estimateTime: new Date().toISOString(),
      holdings: detail.holdings,
      quotes,
      coveredWeight
    }
  };
}

// ============ 免费数据源（无需 neodata token）============

interface FundQuote {
  code: string;
  name: string;
  navDate: string;
  unitNav: number;
  estimatedNav: number;
  estimatedChangeRate: number;
  estimateTime: string;
}

interface NavHistoryRow {
  date: string;
  unitNav: number;
  accNav: number;
  growthRate: number;
}

async function fetchFundgz(code: string): Promise<FundQuote> {
  // 1. 天天基金 fundgz（场外基金实时估值）
  try {
    const url = `http://fundgz.1234567.com.cn/js/${code}.js`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await res.text();
    const match = text.match(/jsonpgz\((.+)\);?\s*$/);
    if (match) {
      const d = JSON.parse(match[1]);
      if (d.fundcode && d.gsz) {
        return {
          code: d.fundcode,
          name: d.name,
          navDate: d.jzrq,
          unitNav: parseFloat(d.dwjz),
          estimatedNav: parseFloat(d.gsz),
          estimatedChangeRate: parseFloat(d.gszzl),
          estimateTime: d.gztime
        };
      }
    }
  } catch { /* ETF 不支持 fundgz，走 fallback */ }

  // 2. 新浪财经行情（ETF 场内价格）
  const prefix = code.startsWith("5") || code.startsWith("6") ? "sh" : "sz";
  const sinaUrl = `http://hq.sinajs.cn/list=${prefix}${code}`;
  const res = await fetch(sinaUrl, {
    headers: { Referer: "https://finance.sina.com.cn" }
  });
  if (!res.ok) throw new Error(`quote ${res.status}`);
  const text = await res.text();
  const dataMatch = text.match(/"(.+)"/);
  if (!dataMatch) throw new Error("sina quote parse failed");
  const parts = dataMatch[1].split(",");
  if (parts.length < 4) throw new Error("sina quote format error");
  const name = parts[0];
  const prevClose = parseFloat(parts[2]);
  const current = parseFloat(parts[3]);
  const changeRate = prevClose > 0 ? ((current - prevClose) / prevClose) * 100 : 0;
  return {
    code,
    name,
    navDate: new Date().toISOString().split("T")[0],
    unitNav: prevClose,
    estimatedNav: current,
    estimatedChangeRate: changeRate,
    estimateTime: new Date().toISOString()
  };
}

async function fetchNavHistory(code: string, pageSize = 365): Promise<{ list: NavHistoryRow[]; total: number }> {
  const url = `https://api.fund.eastmoney.com/f10/lsjz?fund_code=${code}&page_index=1&page_size=${pageSize}`;
  const res = await fetch(url, {
    headers: {
      Referer: "https://fundf10.eastmoney.com/",
      "User-Agent": "Mozilla/5.0"
    }
  });
  if (!res.ok) throw new Error(`lsjz ${res.status}`);
  const json: any = await res.json();
  const list: NavHistoryRow[] = (json.Data?.LSJZList ?? []).map((r: any) => ({
    date: r.FSRQ,
    unitNav: parseFloat(r.DWJZ),
    accNav: parseFloat(r.LJJZ),
    growthRate: parseFloat(r.JZZZL) || 0
  }));
  return { list, total: json.TotalCount ?? list.length };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") return CORS_PREFLIGHT;

    // ============ admin 路由（不需要 neodata token）============
    if (path === "/api/admin/update-token" && method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        token?: string;
        admin_key?: string;
      };
      if (!body.admin_key || body.admin_key !== env.ADMIN_KEY) {
        return errorResp("admin_key 校验失败", 401);
      }
      if (!body.token) return errorResp("缺少 token", 400);
      await setToken(env, body.token);
      return jsonResp({
        code: "200",
        suc: true,
        msg: "token 已热更新",
        data: {
          length: body.token.length,
          hasKV: !!env.TOKEN_KV,
          time: new Date().toISOString()
        }
      });
    }

    if (path === "/api/admin/token-status" && method === "GET") {
      let hasToken = false;
      let source = "none";
      if (env.TOKEN_KV) {
        const kvToken = await env.TOKEN_KV.get("neodata_token");
        if (kvToken) {
          hasToken = true;
          source = "kv";
        }
      }
      if (!hasToken && memoryToken) {
        hasToken = true;
        source = "memory";
      }
      if (!hasToken && env.NEODATA_TOKEN) {
        hasToken = true;
        source = "env";
      }
      return jsonResp({
        code: "200",
        suc: true,
        data: {
          hasToken,
          source,
          hasKV: !!env.TOKEN_KV,
          time: new Date().toISOString()
        }
      });
    }

    // ============ 免费数据源路由（无需 token）============
    if (path === "/api/quotes" && method === "GET") {
      const codesParam = url.searchParams.get("codes");
      if (!codesParam) return errorResp("缺少参数 codes", 400);
      const codes = codesParam.split(",").map((c) => c.trim()).filter(Boolean);
      const results = await Promise.allSettled(codes.map(fetchFundgz));
      const data = results.map((r, i) => ({
        code: codes[i],
        success: r.status === "fulfilled",
        data: r.status === "fulfilled" ? r.value : null,
        error: r.status === "rejected"
          ? (r.reason instanceof Error ? r.reason.message : String(r.reason))
          : null
      }));
      return jsonResp({ code: "200", suc: true, data });
    }

    const quoteMatch = path.match(/^\/api\/quote\/(\d{6})$/);
    if (quoteMatch && method === "GET") {
      try {
        const quote = await fetchFundgz(quoteMatch[1]);
        return jsonResp({ code: "200", suc: true, data: quote });
      } catch (err) {
        return errorResp(err instanceof Error ? err.message : String(err), 502);
      }
    }

    const navHistoryMatch = path.match(/^\/api\/nav-history\/(\d{6})$/);
    if (navHistoryMatch && method === "GET") {
      try {
        const size = parseInt(url.searchParams.get("size") ?? "365");
        const result = await fetchNavHistory(navHistoryMatch[1], size);
        return jsonResp({ code: "200", suc: true, data: result });
      } catch (err) {
        return errorResp(err instanceof Error ? err.message : String(err), 502);
      }
    }

    // ============ 业务路由（需要 neodata token）============
    let token: string;
    try {
      token = await getToken(env);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "TOKEN_MISSING") {
        return errorResp(
          "TOKEN_MISSING: 当前没有任何 neodata token。请在 WorkBuddy 里说\"刷新基金工具 token\"，或调用 POST /api/admin/update-token 注入",
          401
        );
      }
      return errorResp(msg, 500);
    }

    try {
      if (path === "/api/health") {
        return jsonResp({ code: "200", suc: true, data: { ok: true, time: new Date().toISOString() } });
      }

      if (path === "/api/search") {
        const q = url.searchParams.get("q");
        if (!q) return errorResp("缺少参数 q", 400);
        const entities = await searchFund(token, q);
        return jsonResp({ code: "200", suc: true, data: { entities } });
      }

      const debugMatch = path.match(/^\/api\/debug\/hold\/([\w.]+)$/);
      if (debugMatch && method === "GET") {
        const raw = await callNeodata(token, `${debugMatch[1]} 基金重仓股票 持仓`, "api");
        return jsonResp({ code: "200", suc: true, data: raw });
      }

      const debugSearchMatch = path.match(/^\/api\/debug\/search\/(.+)$/);
      if (debugSearchMatch && method === "GET") {
        const kw = decodeURIComponent(debugSearchMatch[1]);
        const raw = await callNeodata(token, `${kw} 基金`, "api");
        return jsonResp({ code: "200", suc: true, data: raw });
      }

      const fundMatch = path.match(/^\/api\/fund\/([\w.]+)$/);
      if (fundMatch && method === "GET") {
        const detail = await getFundDetail(token, fundMatch[1]);
        return jsonResp({ code: "200", suc: true, data: detail });
      }

      const estMatch = path.match(/^\/api\/estimate\/([\w.]+)$/);
      if (estMatch && method === "GET") {
        const result = await handleEstimate(token, estMatch[1]);
        return jsonResp({ code: "200", suc: true, data: result });
      }

      // 兼容旧接口路径
      if (path === "/api/refresh-token" && method === "POST") {
        return errorResp("接口已迁移到 POST /api/admin/update-token（需带 admin_key）", 410);
      }

      return errorResp("Not Found", 404);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "TOKEN_EXPIRED") {
        return errorResp(
          "TOKEN_EXPIRED: neodata token 已过期。请在 WorkBuddy 里说\"刷新基金工具 token\"",
          401
        );
      }
      console.error("worker error:", err);
      return errorResp(msg, 500);
    }
  }
};
