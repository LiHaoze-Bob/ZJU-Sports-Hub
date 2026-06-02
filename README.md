# ZJU Sports Hub — 浙大体育赛事聚合平台

为浙大学生聚合校内体育社团公众号发布的赛事信息，不错过每一场精彩比赛。

> 实时站点: [zju-sports.pages.dev](https://zju-sports.pages.dev)（国内可访问）| [sqtp.vercel.app](https://sqtp.vercel.app)

## 技术栈

- **前端**: Next.js 14 (App Router) + Tailwind CSS
- **图标**: Lucide React
- **数据采集**: we-mp-rss (Docker) → RSS → DeepSeek LLM 解析
- **部署**: Cloudflare Pages（国内可访问） + Vercel（备用），Git Push 双平台自动上线

## 数据流水线

```
微信公众平台 ──▶ we-mp-rss (Docker) ──▶ RSS feeds ──▶ sync-rss.ts ──▶
                                                                      │
  urls.txt ──▶ fetch-wechat.ts ──▶ LLM 解析 ──▶ events.json ──▶ 前端
```

每天 9:30 全自动运行：`git pull → 抓取文章 → RSS 同步 → LLM 解析 → 清理过期 → 构建 → 部署`

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
  -e WE_RSS.AUTH=True \
  -e DEBUG=True \
  -v $(pwd)/.we-mp-rss-data:/app/data \
  ghcr.io/rachelos/we-mp-rss:latest
```

然后打开 `http://localhost:8001`：
1. 用默认账号 `admin` / `admin123` 登录
2. 扫码授权微信公众平台
3. 添加公众号（搜索名称 → 添加订阅）

> `WE_RSS.AUTH=True` 会在后台每 10 分钟自动续期微信登录态，避免过期。
>
> 如果忘记密码，可以重置：
> ```bash
> docker exec we-mp-rss /app/env_x86_64/bin/python3 -c "
> import bcrypt, sqlite3
> h = bcrypt.hashpw('admin123'.encode(), bcrypt.gensalt()).decode()
> sqlite3.connect('/app/data/db.db').execute('UPDATE users SET password_hash=? WHERE username=?', (h, 'admin'))
> "
> ```

### 初始化数据

```bash
npm run sync-rss -- --parse   # RSS → 抓取 → LLM 解析 → 入库
git push                       # 触发 Cloudflare + Vercel 自动部署
```

### 自动同步

定时任务通过 macOS launchd 配置，每天 **9:30 AM** 运行：

```bash
bash /Users/bob.li/Code/ZJU-Sports-Hub/scripts/auto-sync.sh
```

**脚本流程**：

| 步骤 | 操作 | 说明 |
|------|------|------|
| 0 | `git pull --rebase` | 拉取最新代码，避免冲突 |
| 1 | 启动/检查 we-mp-rss | 确保容器运行，等待服务就绪 |
| 2 | `fetch_all_article()` | 从微信抓取新文章 |
| 3 | `sync-rss --parse` | RSS → 下载 → LLM 解析 → 入库 |
| 4 | 清理过期 | 删除 7 天前的 `.txt` 文件 |
| 5 | `next build` | 构建静态站点 |
| 6 | git push + deploy | 仅有赛事变更时才推送 |
| 7 | Docker 清理 | 每周日自动 `docker system prune` |

**特性**：
- 容器 **持续运行**，保持微信登录态，cron 每 59 分钟自动检查新文章
- **有变化才 push**，不会产生空提交
- 每周日自动清理 Docker 磁盘占用
- 详细日志写入 `.auto-sync-detail.log`，主日志 `.auto-sync.log` 保持简洁

**日志**：

```bash
tail -f .auto-sync.log          # 实时查看
tail -f .auto-sync-detail.log   # 详细输出（npm/build/docker 完整日志）
```

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
├── crawl.ts                    # LLM 解析（含去重 + 过期清理）
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
| 浙大台协 | 台球积分赛、六球大奖赛 | 紫金港 |
| 浙江大学排球社 | 排球赛、球势杯 | 紫金港 |

> 数据来源：以上公众号公开发布的推文，通过 [we-mp-rss](https://github.com/rachelos/we-mp-rss) 转换为 RSS 订阅源。

## 展望

- [x] 同步时自动清理超过 5 天的过期赛事
- [x] 支持动态发现新公众号（RSS 自动识别）
- [x] 每日全自动同步 + 部署流水线
- [x] Docker 容器持续运行，自动续期微信登录
- [ ] 每日微信/钉钉推送新赛事摘要
- [ ] 接入更多浙大校内体育公众号
- [ ] 支持更多校区（玉泉、西溪、舟山、海宁）

## 许可

MIT
