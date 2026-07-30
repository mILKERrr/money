# 基金实时估值工具

手机直接访问的 H5 + PWA 基金估值小工具。输入基金代码 → 添加持仓 → 盘中每分钟自动算出估算净值。

## 核心特性

- 移动端优先 UI，可"添加到主屏幕"当 App 用
- 基金搜索、持仓管理（份额/成本净值）
- 盘中实时估值：用最新季报持仓权重 × 个股实时涨跌幅 加权计算
- 数据全部本地存储（localStorage），换设备会丢
- 持仓覆盖度提示（前十大持仓权重比例）
- A股涨红跌绿（中国股市配色）

## 项目结构

```
fund-estimator/
├── frontend/                # React 18 + TS + Vite + Tailwind + PWA
│   ├── src/
│   │   ├── components/     # FundCard / HoldingEditor / EstimateBadge
│   │   ├── hooks/           # useEstimate（轮询刷新）
│   │   ├── lib/             # api / 估值计算
│   │   ├── pages/           # Home / AddFund / FundDetail
│   │   ├── store/           # Zustand 持仓 store（持久化）
│   │   └── types/
│   └── public/
├── worker/                  # Cloudflare Workers API 代理
│   └── src/index.ts        # neodata API 鉴权 + Markdown 表格解析 + 估值聚合
└── README.md
```

## 实时估值原理

```
估算净值 ≈ T-1日单位净值 × (1 + Σ(持仓权重_i × 个股涨跌幅_i))
```

- 持仓权重来自最新季报前十大持仓
- 未覆盖部分（剩余权重）按已覆盖部分的平均涨跌幅补全
- 数据源：腾讯 neodata 服务

## 快速开始

### 前置准备

1. 安装 [Node.js 22+](https://nodejs.org)
2. 注册 [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费）
3. 安装 wrangler：`npm install -g wrangler`，然后 `wrangler login`

### 一、跑起来 Worker（API 代理）

```bash
cd worker
npm install

# 拿 neodata token：
#   1. 在 WorkBuddy 里调用 neodata-financial-search skill 查询一次
#   2. token 缓存在 builtin-skills/.neodata_token，复制出来
#   3. 或通过 connect_cloud_service 工具获取

# 本地开发用 .dev.vars
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars 填入：NEODATA_TOKEN=<你的 token>

# 启动本地 Worker
npm run dev
# 输出 http://127.0.0.1:8787
```

验证：
```bash
curl "http://127.0.0.1:8787/api/health"
# {"code":"200","suc":true,"data":{"ok":true,...}}

curl "http://127.0.0.1:8787/api/search?q=161725"
# {"code":"200","suc":true,"data":{"entities":[...]}}

curl "http://127.0.0.1:8787/api/estimate/161725"
# {"code":"200","suc":true,"data":{"estimate":{...}}}
```

### 二、跑起来前端

```bash
cd frontend
npm install

# 配置 API 地址指向本地 Worker
cp .env.example .env
# 编辑 .env：VITE_API_BASE=http://127.0.0.1:8787/api

npm run dev
# 输出 http://localhost:5173
```

手机访问：确保手机和电脑同 WiFi，浏览器开 http://<电脑IP>:5173

### 三、部署到公网

**Worker 部署：**
```bash
cd worker
# 注入生产 token（推荐方式，安全）
echo "<你的 token>" | npx wrangler secret put NEODATA_TOKEN

npm run deploy
# 输出 https://fund-estimator.<your-subdomain>.workers.dev
```

⚠️ Token 12 小时过期。两种处理方式：
- **手动刷新**：每 12 小时跑一次 `wrangler secret put NEODATA_TOKEN` 重新注入
- **自动刷新**（推荐）：用 [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) + 一个内部刷新端点（需要进一步开发，本期未实现）

**前端部署到 Cloudflare Pages：**
```bash
cd frontend
# 改 .env：VITE_API_BASE=https://fund-estimator.<your-subdomain>.workers.dev/api
npm run build
# 把 dist/ 目录上传到 Cloudflare Pages，或用 wrangler pages deploy dist
npx wrangler pages deploy dist --project-name fund-estimator
```

部署完打开 Pages 给的域名，手机浏览器访问 → 浏览器菜单"添加到主屏幕" → 像 App 一样使用。

## API 接口

| 路径 | 方法 | 说明 |
|---|---|---|
| `/api/health` | GET | 健康检查 |
| `/api/search?q=keyword` | GET | 搜索基金，返回基金代码+名称列表 |
| `/api/fund/:code` | GET | 基金详情：净值历史 + 前十大持仓 |
| `/api/estimate/:code` | GET | 盘中实时估值（聚合多查询） |

## 估值精度的坑（务必告知自己）

1. **季报滞后**：Q1 季报 4 月底才披露，期间调仓不可见。指数基金滞后问题小，主动管理型基金偏差大。
2. **前十大 ≠ 全部持仓**：典型指数基金前十大覆盖 ~80%，剩余靠"已覆盖部分的平均涨跌幅"补全。
3. **停牌 / 跌停 / 涨停**：涨跌幅=0 但真实价值可能已变。
4. **港股通基金**（如中概互联）：要叠加汇率因素，当前实现未做。
5. **QDII 基金**：估值跟外盘隔一天，参考意义有限。

## 技术栈

- 前端：React 18 + TypeScript + Vite + Tailwind + vite-plugin-pwa + Zustand + react-router-dom + lucide-react
- 后端：Cloudflare Workers (TypeScript) + wrangler
- 数据源：腾讯 neodata 服务（通过 WorkBuddy 的 neodata-financial-search skill 拿到 token）

## 已知限制 & 后续可加

- [ ] Token 自动刷新（Cloudflare Cron）
- [ ] 港股汇率换算
- [ ] 净值历史折线图
- [ ] 多设备同步（后端 KV 存持仓）
- [ ] 估值偏离度对比（估值 vs 实际净值）
- [ ] 自定义刷新间隔
- [ ] 深色模式
