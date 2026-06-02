#!/bin/bash
# ZJU Sports Hub — 自动同步脚本
# 由 launchd 定时触发，每天 9:30 运行
#
# 流程: git pull → Docker + we-mp-rss → 抓取文章 → RSS → LLM 解析
#       → 清理过期 → 构建 → 有变更则 push + 部署 → 清理 Docker

set -e
cd /Users/bob.li/Code/ZJU-Sports-Hub
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
export NO_PROXY=localhost,127.0.0.1
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

LOG_FILE="/Users/bob.li/Code/ZJU-Sports-Hub/.auto-sync.log"
DETAIL_LOG="/Users/bob.li/Code/ZJU-Sports-Hub/.auto-sync-detail.log"

# ── helpers ──
ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(ts)] $1" >> "$LOG_FILE"; }
detail() { echo "[$(ts)] $1" >> "$DETAIL_LOG"; }

echo "" >> "$LOG_FILE"
log "═════ 开始自动同步 ═════"

# ── Step 0: Git pull ──
log "Git pull..."
git pull --rebase origin main >> "$DETAIL_LOG" 2>&1 && log "  ✓ pull 完成" || { log "  ⚠️ pull 失败，继续..."; git rebase --abort 2>/dev/null || true; }

# ── Step 1: Ensure Docker + we-mp-rss ──
log "Docker..."
open -a Docker 2>/dev/null || true
for i in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 2; done
log "  ✓ 已就绪"

if ! docker ps --filter name=we-mp-rss --format '{{.ID}}' | grep -q .; then
  if docker ps -a --filter name=we-mp-rss --format '{{.ID}}' | grep -q .; then
    log "启动 we-mp-rss..."
    docker start we-mp-rss >> "$DETAIL_LOG" 2>&1
  else
    log "创建 we-mp-rss..."
    docker run -d --name we-mp-rss -p 8001:8001 \
      -e WE_RSS.AUTH=True -e DEBUG=True \
      -v /Users/bob.li/Code/ZJU-Sports-Hub/.we-mp-rss-data:/app/data \
      ghcr.io/rachelos/we-mp-rss:latest >> "$DETAIL_LOG" 2>&1
  fi
fi

for i in $(seq 1 60); do
  curl -s -o /dev/null http://localhost:8001/api/v1/wx/sys/info 2>/dev/null && { log "  ✓ we-mp-rss 就绪"; break; }
  sleep 2
done

# ── Step 2: Fetch articles from WeChat ──
log "抓取公众号文章..."
FETCH_RESULT=$(docker exec we-mp-rss /app/env_x86_64/bin/python3 -c "
from jobs.mps import fetch_all_article
fetch_all_article()
" 2>&1)
echo "$FETCH_RESULT" >> "$DETAIL_LOG"
NEW_COUNT=$(echo "$FETCH_RESULT" | grep -oP '共更新\K\d+' || echo "0")
log "  ✓ 完成 (新文章: $NEW_COUNT)"

# ── Step 3: Sync RSS + LLM parse ──
log "RSS 同步 & LLM 解析..."
SYNC_OUTPUT=$(NO_PROXY=localhost,127.0.0.1 npm run sync-rss -- --parse 2>&1)
echo "$SYNC_OUTPUT" >> "$DETAIL_LOG"
EVENT_COUNT=$(echo "$SYNC_OUTPUT" | grep -oP '已保存 \K\d+' || echo "0")
NEW_URLS=$(echo "$SYNC_OUTPUT" | grep "✅ 新增" | grep -oP '\d+' | head -1 || echo "0")
log "  ✓ 新增 $NEW_URLS 篇文章，$EVENT_COUNT 条赛事"

# ── Step 4: Clean up ──
log "清理..."
# delete .txt files older than 7 days
OLD_FILES=$(find /Users/bob.li/Code/ZJU-Sports-Hub/articles/ -name "*.txt" -mtime +7 -delete -print 2>/dev/null | wc -l)
log "  ✓ 删除 $OLD_FILES 个过期文章文件"

# ── Step 5: Build ──
log "构建..."
npm run build >> "$DETAIL_LOG" 2>&1
log "  ✓ 构建完成"

# ── Step 6: Git push + deploy (only if events changed) ──
if git diff --quiet src/data/events.json; then
  log "部署: 无新赛事，跳过"
else
  git add src/data/events.json urls.txt web.md articles/ 2>/dev/null || true
  git add -u src/data/events.json urls.txt web.md articles/ 2>/dev/null || true
  if ! git diff --cached --quiet; then
    git commit -m "auto: sync events $(date '+%Y-%m-%d')" >> "$DETAIL_LOG" 2>&1
    git push origin main >> "$DETAIL_LOG" 2>&1
    log "  ✓ GitHub 推送完成"
  fi
  npx wrangler pages deploy out --project-name=zju-sports --branch=main >> "$DETAIL_LOG" 2>&1
  log "  ✓ Cloudflare 部署完成"
fi

# ── Step 7: Weekly Docker cleanup (Sunday only) ──
if [ "$(date +%u)" = "7" ]; then
  log "Docker 磁盘清理..."
  docker system prune -f --filter "until=168h" >> "$DETAIL_LOG" 2>&1
  log "  ✓ 清理完成"
fi

log "同步完成"

# ── Open log at bottom in VSCode ──
code --goto "$LOG_FILE":$(wc -l < "$LOG_FILE" | tr -d ' ') 2>/dev/null || open "$LOG_FILE"
