/**
 * 轻量 dev API 服务器 —— 复刻 Worker 免费数据源
 * 天天基金 fundgz（场外基金） + 新浪财经（ETF 场内价格）+ 东方财富 lsjz（净值历史）
 * 端口 8787，配合 vite dev proxy 使用
 */
import http from "node:http";

const PORT = 8787;

function json(res, data, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function errorResp(res, msg, status = 500) {
  json(res, { code: String(status), suc: false, msg }, status);
}

async function fetchFundgz(code) {
  // 1. 天天基金 fundgz（场外基金实时估值）
  try {
    const url = `http://fundgz.1234567.com.cn/js/${code}.js`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const text = await r.text();
    const m = text.match(/jsonpgz\((.+)\);?\s*$/);
    if (m) {
      const d = JSON.parse(m[1]);
      if (d.fundcode && d.gsz) {
        return {
          code: d.fundcode,
          name: d.name,
          navDate: d.jzrq,
          unitNav: parseFloat(d.dwjz),
          estimatedNav: parseFloat(d.gsz),
          estimatedChangeRate: parseFloat(d.gszzl),
          estimateTime: d.gztime,
        };
      }
    }
  } catch { /* ETF 不支持 fundgz，走 fallback */ }

  // 2. 新浪财经行情（ETF 场内价格）
  const prefix = code.startsWith("5") || code.startsWith("6") ? "sh" : "sz";
  const sinaUrl = `http://hq.sinajs.cn/list=${prefix}${code}`;
  const res = await fetch(sinaUrl, {
    headers: { Referer: "https://finance.sina.com.cn" },
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
    estimateTime: new Date().toISOString(),
  };
}

async function fetchNavHistory(code, pageSize = 365) {
  const url = `https://api.fund.eastmoney.com/f10/lsjz?fund_code=${code}&page_index=1&page_size=${pageSize}`;
  const res = await fetch(url, {
    headers: {
      Referer: "https://fundf10.eastmoney.com/",
      "User-Agent": "Mozilla/5.0",
    },
  });
  if (!res.ok) throw new Error(`lsjz ${res.status}`);
  const j = await res.json();
  const list = (j.Data?.LSJZList ?? []).map((r) => ({
    date: r.FSRQ,
    unitNav: parseFloat(r.DWJZ),
    accNav: parseFloat(r.LJJZ),
    growthRate: parseFloat(r.JZZZL) || 0,
  }));
  return { list, total: j.TotalCount ?? list.length };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }

  if (path === "/api/health") {
    return json(res, { code: "200", suc: true, data: { ok: true, time: new Date().toISOString() } });
  }

  // 批量行情
  if (path === "/api/quotes" && method === "GET") {
    const codesParam = url.searchParams.get("codes");
    if (!codesParam) return errorResp(res, "缺少参数 codes", 400);
    const codes = codesParam.split(",").map((c) => c.trim()).filter(Boolean);
    const results = await Promise.allSettled(codes.map(fetchFundgz));
    const data = results.map((r, i) => ({
      code: codes[i],
      success: r.status === "fulfilled",
      data: r.status === "fulfilled" ? r.value : null,
      error: r.status === "rejected" ? (r.reason?.message || String(r.reason)) : null,
    }));
    return json(res, { code: "200", suc: true, data });
  }

  // 单个行情
  const quoteMatch = path.match(/^\/api\/quote\/(\d{6})$/);
  if (quoteMatch && method === "GET") {
    try {
      const quote = await fetchFundgz(quoteMatch[1]);
      return json(res, { code: "200", suc: true, data: quote });
    } catch (err) {
      return errorResp(res, err.message, 502);
    }
  }

  // 净值历史
  const navMatch = path.match(/^\/api\/nav-history\/(\d{6})$/);
  if (navMatch && method === "GET") {
    try {
      const size = parseInt(url.searchParams.get("size") || "365");
      const result = await fetchNavHistory(navMatch[1], size);
      return json(res, { code: "200", suc: true, data: result });
    } catch (err) {
      return errorResp(res, err.message, 502);
    }
  }

  return errorResp(res, "Not Found", 404);
});

server.listen(PORT, () => {
  console.log(`[dev-api] 免费数据源 API 运行在 http://127.0.0.1:${PORT}`);
  console.log(`[dev-api] 支持: /api/quote/:code, /api/quotes?codes=, /api/nav-history/:code`);
});
