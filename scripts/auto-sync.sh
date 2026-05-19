#!/bin/bash
# ZJU Sports Hub — 自动同步脚本
# 由 launchd 定时触发，每 2 天运行一次
#
# 流程: RSS → URLs → Fetch → LLM Parse → Git Push → Vercel Deploy

set -e
cd /Users/bob.li/Code/SQTP
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

LOG_FILE="/Users/bob.li/Code/SQTP/.auto-sync.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始自动同步..." >> "$LOG_FILE"

# Step 1: Sync from RSS
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 拉取 RSS..." >> "$LOG_FILE"
npm run sync-rss -- --parse >> "$LOG_FILE" 2>&1 || {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] sync-rss 失败" >> "$LOG_FILE"
  exit 1
}

# Step 2: Push to GitHub (triggers Vercel deploy)
if git diff --quiet src/data/events.json; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 无新赛事，跳过推送" >> "$LOG_FILE"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 有新赛事，推送到 GitHub..." >> "$LOG_FILE"
  git add src/data/events.json urls.txt web.md articles/
  git commit -m "auto: sync events $(date '+%Y-%m-%d')" >> "$LOG_FILE" 2>&1
  git push origin main >> "$LOG_FILE" 2>&1
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 推送完成，Vercel 将自动部署" >> "$LOG_FILE"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 同步完成" >> "$LOG_FILE"
