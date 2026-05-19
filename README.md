# ZJU Sports Hub — 浙大体育赛事聚合平台

为浙大学生聚合校内体育社团公众号发布的赛事信息，不错过每一场精彩比赛。

> 实时站点: [zju-sports-hub.pages.dev](https://zju-sports-hub.pages.dev)（国内可访问）\| [sqtp.vercel.app](https://sqtp.vercel.app)

## 技术栈

- **前端**: Next.js 14 (App Router) + Tailwind CSS
- **图标**: Lucide React
- **数据采集**: we-mp-rss (Docker) → RSS → DeepSeek LLM 解析
- **部署**: Cloudflare Pages（国内可访问） + Vercel（备用），Git Push 双平台自动上线

## 数据流水线

```
微信公众平台 ──▶ we-mp-rss (Docker) ──▶ RSS feeds ──▶ sync-rss.ts ──▶
                                                                      │
  urls.txt ──▶ fetch-wechat.ts ──▶ LLM 解析 ──▶ events.json ──▶ Vercel 前端
```

## 快速开始

只需 Node.js，无需 API Key 即可看到已有数据：

```bash
npm install
npm run dev        # → http://localhost:3000
```

前端自动读取 `src/data/events.json`，包含已解析的赛事数据。

## 完整部署（采集 + 解析 + 上线）

要接入新数据需要两部分：**数据管道**（本地 Mac）和 **前端托管**（Cloudflare/Vercel，自动部署）。

### 准备工作

1. **DeepSeek API Key**：注册 [DeepSeek](https://platform.deepseek.com) → 获取 API Key
2. **创建 `.env.local`**：
   ```env
   LLM_API_KEY=sk-your-api-key
   LLM_BASE_URL=https://api.deepseek.com/v1
   LLM_MODEL=deepseek-chat
   ```
3. **Docker Desktop**：下载 [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 部署 we-mp-rss（微信 RSS 服务）

```bash
docker run -d --name we-mp-rss -p 8001:8001 \
  -v ~/we-mp-rss-data:/app/data \
  ghcr.io/rachelos/we-mp-rss:latest
```

然后打开 `http://localhost:8001`，用默认账号登录后扫码授权微信。

### 添加公众号

在 we-mp-rss 网页界面中添加公众号：

1. 点击「添加订阅」→ 搜索公众号名称
2. 添加目标公众号（如「浙大乒协」）
3. 等待自动同步（或点「同步」按钮手动触发）

> 注意：扫码授权需要有一个微信公众平台账号（免费注册即可）。如果没有，可以手动往 `urls.txt` 粘贴微信文章链接，也能走通后续流程。

### 初始化数据

```bash
npm run sync-rss -- --parse   # RSS → 抓取 → LLM 解析 → 入库
git push                       # 触发 Cloudflare + Vercel 自动部署
```

### 自动同步（每 2 天）

定时任务已通过 macOS launchd 配置：

1. 自动启动 Docker → we-mp-rss 同步微信
2. 提取 RSS → 抓取文章 → LLM 解析 → 更新 events.json
3. git push → 双平台自动部署
4. 关闭 Docker 释放资源

查看日志：`cat .auto-sync.log`

## 项目结构

```
src/
├── app/
│   ├── layout.tsx              # 根布局
│   └── page.tsx                # 主页（仅展示近5天赛事）
├── components/
│   ├── EventCard.tsx           # 赛事卡片
│   ├── FilterBar.tsx           # 校区/类别筛选
│   ├── CountdownBadge.tsx      # 报名倒计时
│   └── EmptyState.tsx          # 空状态
├── lib/
│   ├── types.ts                # 类型定义
│   ├── llmParser.ts            # LLM 解析 + JSON 修复
│   └── sources.ts              # 目标公众号配置
├── data/
│   └── events.json             # 结构化赛事数据
scripts/
├── auto-sync.sh                # 定时任务脚本
├── fetch-wechat.ts             # 微信推文抓取
├── crawl.ts                    # LLM 解析
└── sync-rss.ts                 # RSS → URLs 提取
```

## 数据模型

`MatchEvent`:

| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 赛事标题 |
| category | ball / track / water / other | 类别 |
| campus | zijingang / yuquan / ... | 校区 |
| event_date | string (YYYY-MM-DD) | 比赛日期 |
| deadline | string (YYYY-MM-DD) | 报名截止 |
| location | string | 比赛地点 |
| original_url | string | 原文链接 |
| summary | string | 赛事简介 |
| is_official | boolean | 是否含二课/综素 |


## 已支持的公众号

| 公众号 | 覆盖内容 | 校区 |
|--------|---------|------|
| 浙大体育与艺术 | 三好杯、校运会等校级赛事 | 全部校区 |
| 浙大乒协 | 乒乓球赛事、辅导站、精品课 | 紫金港 |
| 浙大羽协 | 羽毛球春季杯、三好杯羽毛球 | 紫金港 |
| 浙大足协 | 足球联赛、三好杯足球 | 紫金港 |
| 浙大篮联 | 篮联杯、三好杯篮球 | 紫金港 |
| 浙大网协 | 网球精品课、抢七大赛 | 紫金港 |

> 数据来源：以上公众号公开发布的推文，通过 [we-mp-rss](https://github.com/rachelos/we-mp-rss) 转换为 RSS 订阅源。感谢 we-mp-rss 项目提供的灵感与技术方案。

## 展望

- [ ] 每日微信/钉钉推送新赛事摘要
- [ ] 接入更多浙大校内体育公众号
- [ ] 支持更多校区（玉泉、西溪、舟山、海宁）

## 许可

MIT
