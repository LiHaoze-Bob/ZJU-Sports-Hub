/**
 * ZJU Sports Hub — 从 we-mp-rss 同步文章链接
 *
 * 用法：
 *   npx tsx scripts/sync-rss.ts             拉取 RSS → 更新 urls.txt/web.md
 *   npx tsx scripts/sync-rss.ts --parse     拉取后自动跑 fetch + crawl 流水线
 *
 * 前置条件：
 *   we-mp-rss Docker 容器运行在 localhost:8001
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const RSS_BASE = "http://localhost:8001/rss";
const URLS_FILE = path.resolve(__dirname, "../urls.txt");
const WEBMD_FILE = path.resolve(__dirname, "../web.md");

interface FeedInfo {
  id: string;
  name: string;
}

/**
 * Discover feeds dynamically by querying the we-mp-rss database.
 * Falls back to a hardcoded list if the database is not accessible.
 */
function discoverFeeds(): FeedInfo[] {
  try {
    const { execSync } = require("node:child_process");
    const output = execSync(
      `docker exec we-mp-rss /app/env_x86_64/bin/python3 -c "
import sqlite3
conn = sqlite3.connect('/app/data/db.db')
cur = conn.cursor()
cur.execute('SELECT id, mp_name FROM feeds WHERE status=1')
for r in cur.fetchall():
    print(f'{r[0]}|{r[1]}')
"`,
      { encoding: "utf-8", timeout: 5000 }
    );
    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [id, name] = line.split("|");
        return { id, name };
      });
  } catch {
    console.warn("⚠️  无法读取 we-mp-rss 数据库，使用默认 feed 列表");
    return [
      { id: "MP_WXS_3070994044", name: "浙大体育与艺术" },
      { id: "MP_WXS_3564950020", name: "浙大乒协" },
      { id: "MP_WXS_3286401661", name: "浙大羽协" },
      { id: "MP_WXS_3010053825", name: "浙大足协" },
      { id: "MP_WXS_3096293834", name: "浙大篮联" },
      { id: "MP_WXS_3296204068", name: "浙大网协" },
    ];
  }
}

const FEEDS = discoverFeeds();

function extractUrlsFromRSS(xml: string): string[] {
  const urls: string[] = [];
  const regex = /<link>https?:\/\/mp\.weixin\.qq\.com\/s\/[^<]+<\/link>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const raw = match[0].replace(/^<link>/, "").replace(/<\/link>$/, "");
    // Strip query params and amp escapes
    const clean = raw.split("?")[0].replace(/&amp;/g, "&");
    urls.push(clean);
  }
  return [...new Set(urls)];
}

async function syncFeeds(autoParse: boolean) {
  // Load existing URLs
  const existingUrls = new Set<string>();
  if (fs.existsSync(URLS_FILE)) {
    fs.readFileSync(URLS_FILE, "utf-8")
      .split("\n")
      .filter(Boolean)
      .forEach((u) => existingUrls.add(u.trim()));
  }

  console.log(`📡 读取 RSS 订阅 (${FEEDS.length} 个公众号)...\n`);

  const allNewUrls: string[] = [];
  let totalArticles = 0;

  for (const feed of FEEDS) {
    try {
      const response = await fetch(`${RSS_BASE}/${feed.id}?limit=100`);
      if (!response.ok) {
        console.log(`   ⚠️  ${feed.name}: HTTP ${response.status}`);
        continue;
      }
      const xml = await response.text();
      const urls = extractUrlsFromRSS(xml);
      const newUrls = urls.filter((u) => !existingUrls.has(u));

      totalArticles += urls.length;
      const flag = newUrls.length > 0 ? `✨ +${newUrls.length}` : "─";
      console.log(`   ${flag}  ${feed.name}: ${urls.length} 篇文章`);
      allNewUrls.push(...newUrls);
    } catch (err) {
      console.log(`   ❌ ${feed.name}: ${(err as Error).message}`);
    }
  }

  if (allNewUrls.length > 0) {
    const allUrls = [...existingUrls, ...allNewUrls];
    fs.writeFileSync(URLS_FILE, allUrls.join("\n") + "\n", "utf-8");
    fs.writeFileSync(WEBMD_FILE, allUrls.join("\n") + "\n", "utf-8");
    console.log(`\n✅ 新增 ${allNewUrls.length} 篇，总计 ${allUrls.length} 篇`);
    console.log(`   已保存: urls.txt + web.md`);

    if (autoParse) {
      console.log(`\n🤖 运行 fetch + parse 流水线...`);
      try {
        execSync("npm run fetch -- --urls urls.txt --parse", {
          cwd: path.resolve(__dirname, ".."),
          stdio: "inherit",
        });
      } catch (err) {
        console.error("流水线执行失败:", (err as Error).message);
        process.exit(1);
      }
    } else {
      console.log(`\n💡 下一步: npm run fetch -- --urls urls.txt --parse`);
    }
  } else {
    console.log(
      `\n⏳ 暂无新文章 (已拉取 ${totalArticles} 篇，均为已收录)`
    );
    if (totalArticles === 0) {
      console.log(
        "   we-mp-rss 可能还在同步中，请稍后重试。"
      );
    }
  }
}

const autoParse = process.argv.includes("--parse");
syncFeeds(autoParse).catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
