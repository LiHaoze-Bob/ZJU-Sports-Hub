# ZJU Sports Hub — 浙大体育赛事聚合平台

为浙大学生聚合校内各公众号发布的体育赛事信息，不错过每一场精彩比赛。

## 技术栈

- **前端**: Next.js 14 (App Router) + Tailwind CSS
- **图标**: Lucide React
- **数据处理**: LLM（DeepSeek / OpenAI 兼容 API）

## 快速开始

```bash
npm install
npm run dev
# 访问 http://localhost:3000
```

## 数据管道（三步）

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ 获取推文链接  │ ──▶ │ 抓取正文+LLM解析 │ ──▶ │ 前端自动展示      │
│ npm run fetch│     │ npm run crawl   │     │ events.json → UI │
└──────────────┘     └─────────────────┘     └──────────────────┘
```

### Step 1: 发现文章

```bash
# 搜狗搜索公众号文章（显示标题列表）
npm run fetch -- --search "浙大体育与艺术"

# 搜索全部已配置公众号
npm run fetch -- --search --all
```

搜索结果会列出文章标题。在浏览器中打开搜狗链接 → 跳转到微信文章页 → 复制地址栏 `mp.weixin.qq.com/s/xxx` 链接 → 粘贴到 `urls.txt`（每行一个）。

### Step 2: 抓取 + 解析

```bash
# 一键：抓取正文 + LLM 解析入库
npm run fetch -- --urls urls.txt --parse

# 或分步操作：
npm run fetch -- --urls urls.txt    # 只抓取，保存到 articles/
npm run crawl -- --dir articles/     # 只解析
```

### Step 3: 查看结果

前端页面自动加载 `src/data/events.json`。刷新 `http://localhost:3000` 即可看到新数据。

## 项目结构

```
src/
├── app/
│   ├── layout.tsx              # 根布局
│   ├── page.tsx                # 主页（赛事列表 + 筛选 + 早报）
│   ├── globals.css             # 全局样式
│   └── api/parse-article/      # LLM 解析 API Route
├── components/
│   ├── EventCard.tsx           # 赛事卡片
│   ├── FilterBar.tsx           # 校区/类别筛选
│   ├── CountdownBadge.tsx      # 报名倒计时
│   ├── DailyBriefing.tsx       # 今日体育早报（可复制分享）
│   └── EmptyState.tsx          # 空状态
├── lib/
│   ├── types.ts                # MatchEvent 类型定义
│   ├── mockData.ts             # 模拟数据（动态日期）
│   ├── llmParser.ts            # LLM 解析 + JSON 修复
│   └── sources.ts              # 目标公众号配置
├── data/
│   └── events.json             # 爬取+解析后的结构化赛事数据
scripts/
├── fetch-wechat.ts             # 微信推文抓取脚本
└── crawl.ts                    # LLM 解析脚本
articles/                       # 抓取的推文正文 (.txt)
urls.txt                        # 待抓取文章链接列表
```

## Vercel 部署

零配置，三步上线：

```bash
# 1. 推送到 GitHub
git init && git add . && git commit -m "MVP"
gh repo create zju-sports-hub --public --source=. --push

# 2. 在 vercel.com 导入仓库，添加环境变量：
#    LLM_API_KEY=sk-xxx
#    LLM_BASE_URL=https://api.deepseek.com/v1
#    LLM_MODEL=deepseek-chat

# 3. 自动部署，以后 git push 即更新
```

或使用 CLI：

```bash
npm i -g vercel
vercel --prod
```

## 配置 LLM API

复制 `.env.local.example` 为 `.env.local`，填入 API Key：

```env
LLM_API_KEY=sk-your-api-key-here
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
```

支持的模型：DeepSeek (`deepseek-chat`)、OpenAI (`gpt-4o-mini`) 及任何兼容 OpenAI 接口的服务。

## 数据模型

`MatchEvent`：

| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 赛事标题 |
| category | ball / track / water / other | 类别 |
| campus | zijingang / yuquan / xixi / huajiachi / zhoushan / haining | 校区 |
| event_date | string (YYYY-MM-DD) | 比赛日期 |
| deadline | string (YYYY-MM-DD) | 报名截止 |
| location | string | 比赛地点 |
| original_url | string | 原文链接 |
| summary | string | 赛事简介 |
| is_official | boolean | 是否含二课/综素 |
| source | string (可选) | 信息来源公众号 |
