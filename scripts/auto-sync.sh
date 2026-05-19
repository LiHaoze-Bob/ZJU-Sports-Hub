#!/bin/bash
# ZJU Sports Hub — 自动同步脚本
# 由 launchd 定时触发，每 2 天运行一次
#
# 流程: 启动 Docker → we-mp-rss 自动同步 → 拉取 RSS → 解析入库
#       → 构建静态站 → 推送 GitHub + Cloudflare → 关闭 Docker

set -e
cd /Users/bob.li/Code/SQTP
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

LOG_FILE="/Users/bob.li/Code/SQTP/.auto-sync.log"
echo "" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ═══ 开始自动同步 ═══" >> "$LOG_FILE"

# ── Step 0: Start Docker + we-mp-rss ──
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 启动 Docker..." >> "$LOG_FILE"
open -a Docker 2>/dev/null || true
for i in $(seq 1 30); do
  if docker info >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Docker 已就绪" >> "$LOG_FILE"

if ! docker ps --filter name=we-mp-rss --format '{{.ID}}' | grep -q .; then
  if docker ps -a --filter name=we-mp-rss --format '{{.ID}}' | grep -q .; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] 启动 we-mp-rss 容器..." >> "$LOG_FILE"
    docker start we-mp-rss >> "$LOG_FILE" 2>&1
  else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️ we-mp-rss 容器不存在" >> "$LOG_FILE"
  fi
fi

# Wait for we-mp-rss to boot + auto-sync WeChat articles
# we-mp-rss has ENABLE_JOB=True, so sync starts automatically on boot
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 等待 we-mp-rss 自动同步文章..." >> "$LOG_FILE"
sleep 120

# ── Step 1: Sync from RSS ──
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 拉取 RSS..." >> "$LOG_FILE"
npm run sync-rss -- --parse >> "$LOG_FILE" 2>&1 || {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] sync-rss 失败" >> "$LOG_FILE"
}

# ── Step 2: Rebuild static site ──
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 构建静态站点..." >> "$LOG_FILE"
npm run build >> "$LOG_FILE" 2>&1

# ── Step 3: Push + Deploy ──
if git diff --quiet src/data/events.json; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 无新赛事，跳过部署" >> "$LOG_FILE"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 有新赛事，推送 GitHub..." >> "$LOG_FILE"
  git add src/data/events.json urls.txt web.md articles/
  git commit -m "auto: sync events $(date '+%Y-%m-%d')" >> "$LOG_FILE" 2>&1
  git push origin main >> "$LOG_FILE" 2>&1
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] GitHub 推送完成" >> "$LOG_FILE"

  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 部署 Cloudflare Pages..." >> "$LOG_FILE"
  npx wrangler pages deploy out --project-name=zju-sports --branch=main >> "$LOG_FILE" 2>&1
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cloudflare 部署完成" >> "$LOG_FILE"
fi

# ── Step 4: Shutdown ──
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 停止 we-mp-rss 容器..." >> "$LOG_FILE"
docker stop we-mp-rss >> "$LOG_FILE" 2>&1 || true

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 同步完成" >> "$LOG_FILE"
