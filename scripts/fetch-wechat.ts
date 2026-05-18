/**
 * ZJU Sports Hub — 微信推文抓取脚本
 *
 * 三阶段流程：
 *   1. 搜狗搜索发现文章标题 → 浏览器点开拿真实链接
 *   2. 直连 mp.weixin.qq.com 抓取正文（公开页面，无需登录）
 *   3. LLM 解析正文提取结构化赛事信息
 *
 * 用法：
 *   npm run fetch -- --search "浙大体育与艺术"   搜索+列出文章标题
 *   npm run fetch -- --url "https://mp.weixin.qq.com/s/xxx"   抓取单篇
 *   npm run fetch -- --urls urls.txt   批量抓取 urls.txt 中的链接
 *   npm run fetch -- --urls urls.txt --parse   抓取+LLM解析入库
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { TARGET_SOURCES, WechatSource } from "../src/lib/sources";

const ARTICLES_DIR = path.resolve(__dirname, "../articles");
const URLS_FILE = path.resolve(__dirname, "../urls.txt");

// ---------- HTTP ----------

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHTML(url: string, retries = 2): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await fetch(url, { headers: HEADERS });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (err) {
      if (i === retries) throw err;
      await sleep(2000);
    }
  }
  return "";
}

// ---------- Phase 1: Search (Sogou Web) ----------

interface ArticleEntry {
  title: string;
  sogouUrl: string;
  accountName: string;
  summary: string;
  date: string;
}

function extractSearchResults(html: string, accountName: string): ArticleEntry[] {
  const $ = cheerio.load(html);
  const results: ArticleEntry[] = [];

  // 搜狗 type=2 文章搜索结果的标题链接
  $("a[uigs^='article_title']").each((_, el) => {
    const $el = $(el);
    const title = $el.text().trim().replace(/\s+/g, " ");
    const href = $el.attr("href") || "";

    if (title && href) {
      // 找到相邻的摘要和日期
      const $parent = $el.parent();
      const summary = $parent.find(".txt-info, .s-p-txt").text().trim();
      const date =
        $parent.find(".s2, .time").text().trim() ||
        $parent.parent().find(".s2, .time").text().trim();

      results.push({
        title,
        sogouUrl: href.startsWith("http") ? href : `https://weixin.sogou.com${href}`,
        accountName,
        summary,
        date,
      });
    }
  });

  return results;
}

async function searchAccount(account: WechatSource): Promise<ArticleEntry[]> {
  const query = encodeURIComponent(account.name);
  // type=2 = 搜文章（非搜公众号）
  const url = `https://weixin.sogou.com/weixin?type=2&query=${query}&ie=utf8`;

  try {
    const html = await fetchHTML(url);
    return extractSearchResults(html, account.name);
  } catch (err) {
    console.warn(`   ⚠️ 搜索失败: ${(err as Error).message}`);
    return [];
  }
}

// ---------- Phase 2: Fetch article from mp.weixin.qq.com ----------

interface ArticleContent {
  title: string;
  content: string;
  date: string;
  url: string;
  accountName: string;
}

function extractArticle(html: string): { title: string; content: string; date: string } {
  const $ = cheerio.load(html);
  const title = $("#activity-name").text().trim() || $("title").text().trim();
  const date = $("#publish_time").text().trim();

  const contentEl = $("#js_content")[0] || $(".rich_media_content")[0];
  let content = "";
  if (contentEl) {
    $(contentEl).find("script, style, .reward_area, .ad_container").remove();
    content = $(contentEl).text().trim();
    content = content.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{3,}/g, "  ");
  }

  return { title, content, date };
}

async function fetchArticle(url: string, accountName = ""): Promise<ArticleContent | null> {
  console.log(`📥 抓取: ${url.slice(0, 60)}...`);

  try {
    const html = await fetchHTML(url);
    const { title, content, date } = extractArticle(html);

    if (!content || content.length < 100) {
      console.warn(`   ⚠️ 正文太短 (${content.length} 字符)，可能被拦截`);
      return null;
    }

    // 保存到 articles/
    const safeName = title.replace(/[\/\\:*?"<>|]/g, "").slice(0, 50).trim();
    const filename = `${date ? date.replace(/\//g, "-") + "-" : ""}${safeName}.txt`;
    const filePath = path.join(ARTICLES_DIR, filename);

    const fullText = [
      `# 来源: ${accountName}`,
      `# 标题: ${title}`,
      `# 日期: ${date || "未知"}`,
      `# 链接: ${url}`,
      "",
      content,
    ].join("\n");

    fs.writeFileSync(filePath, fullText, "utf-8");
    console.log(`   ✅ ${filename} (${content.length} 字符)`);
    return { title, content, date, url, accountName };
  } catch (err) {
    console.warn(`   ❌ 失败: ${(err as Error).message}`);
    return null;
  }
}

// ---------- Phase 3: LLM Parse ----------

async function runParsePipe(content: string): Promise<void> {
  console.log("\n🤖 调用 LLM 解析...");
  const { execSync } = await import("node:child_process");
  try {
    execSync(`echo ${JSON.stringify(content)} | npx tsx scripts/crawl.ts`, {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
      env: { ...process.env },
    });
  } catch {
    console.warn("⚠️ 解析失败，可手动运行: npm run crawl -- --dir articles/");
  }
}

async function runParseDir(): Promise<void> {
  console.log("\n🤖 批量 LLM 解析 articles/ ...");
  const { execSync } = await import("node:child_process");
  try {
    execSync(`npx tsx scripts/crawl.ts --dir ${ARTICLES_DIR}`, {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
      env: { ...process.env },
    });
  } catch {
    console.warn("⚠️ 解析失败，可手动运行: npm run crawl -- --dir articles/");
  }
}

// ---------- Main ----------

async function main() {
  const args = process.argv.slice(2);

  // --help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
ZJU Sports Hub — 微信推文抓取脚本

┌─ Phase 1: 发现 ──────────────────────────────────────┐
│ npm run fetch -- --search "浙大体育与艺术"              │
│   → 搜狗搜索文章，列出标题，复制链接到 urls.txt         │
│ npm run fetch -- --search --all                         │
│   → 搜索全部已配置的公众号                              │
├─ Phase 2: 抓取 ──────────────────────────────────────┤
│ npm run fetch -- --url "https://mp.weixin.qq.com/s/xxx" │
│   → 直接抓取单篇文章正文 → articles/*.txt               │
│ npm run fetch -- --urls urls.txt                        │
│   → 批量抓取 urls.txt 中所有链接                        │
├─ Phase 3: 解析 ──────────────────────────────────────┤
│ npm run fetch -- --urls urls.txt --parse               │
│   → 抓取 + 自动 LLM 解析入库                            │
│ npm run crawl -- --dir articles/                        │
│   → 单独对已有文章执行 LLM 解析                         │
└──────────────────────────────────────────────────────┘

结果: src/data/events.json → 前端自动展示
`);
    return;
  }

  const shouldParse = args.includes("--parse");

  // ---------- Mode: --search ----------
  if (args.includes("--search")) {
    const accounts: WechatSource[] = args.includes("--all")
      ? TARGET_SOURCES
      : (() => {
          const idx = args.indexOf("--search");
          const name = idx !== -1 ? args[idx + 1] : "";
          if (!name || name.startsWith("--")) {
            console.log("💡 用法: npm run fetch -- --search \"浙大体育与艺术\"");
            console.log(`   已配置公众号: ${TARGET_SOURCES.map((s) => s.name).join(", ")}`);
            process.exit(0);
          }
          const found = TARGET_SOURCES.find((s) => s.name === name);
          if (!found) {
            console.error(`❌ 未找到: ${name}`);
            process.exit(1);
          }
          return [found];
        })();

    console.log(`🔍 搜索公众号文章...\n`);

    const allResults: ArticleEntry[] = [];
    for (const account of accounts) {
      console.log(`   ${account.name}`);
      const results = await searchAccount(account);
      allResults.push(...results);
    }

    if (allResults.length === 0) {
      console.log("\n😔 未搜到文章（可能被反爬拦截）");
      console.log("💡 请直接在浏览器操作:");
      console.log("   1. 打开 https://weixin.sogou.com");
      console.log("   2. 搜索公众号名称 → 点文章标签");
      console.log("   3. 点开文章 → 复制地址栏的 mp.weixin.qq.com 链接");
      console.log("   4. 粘贴到 urls.txt（每行一个）");
      console.log("   5. 运行: npm run fetch -- --urls urls.txt --parse");
      return;
    }

    console.log(`\n📋 搜索到 ${allResults.length} 篇文章:\n`);
    allResults.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.title}`);
      console.log(`     来源: ${r.accountName} | 日期: ${r.date || "未知"}`);
      console.log(`     搜狗链接: ${r.sogouUrl}`);
      console.log();
    });

    console.log("💡 下一步：在浏览器中依次点开上面的「搜狗链接」→ 自动跳转到微信文章页");
    console.log("   → 复制地址栏 mp.weixin.qq.com/s/xxx 链接 → 粘贴到 urls.txt");
    console.log("   → 运行: npm run fetch -- --urls urls.txt --parse");
    return;
  }

  // ---------- Mode: --url ----------
  const urlIdx = args.indexOf("--url");
  if (urlIdx !== -1 && args[urlIdx + 1]) {
    if (!fs.existsSync(ARTICLES_DIR)) fs.mkdirSync(ARTICLES_DIR, { recursive: true });

    const result = await fetchArticle(args[urlIdx + 1]);
    if (result && shouldParse) {
      const fullText = [
        `# 来源: ${result.accountName}`,
        `# 标题: ${result.title}`,
        `# 日期: ${result.date}`,
        `# 链接: ${result.url}`,
        "",
        result.content,
      ].join("\n");
      await runParsePipe(fullText);
    }
    return;
  }

  // ---------- Mode: --urls ----------
  const urlsIdx = args.indexOf("--urls");
  if (urlsIdx !== -1) {
    const filePath = args[urlsIdx + 1] || URLS_FILE;

    if (!fs.existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${filePath}`);
      console.log("💡 创建 urls.txt，每行粘贴一个 mp.weixin.qq.com/s/xxx 链接");
      process.exit(1);
    }

    if (!fs.existsSync(ARTICLES_DIR)) fs.mkdirSync(ARTICLES_DIR, { recursive: true });

    const content = fs.readFileSync(filePath, "utf-8");
    const urls = content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && l.includes("mp.weixin.qq.com"));

    if (urls.length === 0) {
      console.error("❌ 文件中没有找到 mp.weixin.qq.com 链接");
      process.exit(1);
    }

    console.log(`📋 ${urls.length} 个链接待抓取\n`);

    let count = 0;
    for (const url of urls) {
      const result = await fetchArticle(url);
      if (result) count++;
      await sleep(2000);
    }

    console.log(`\n✅ ${count}/${urls.length} 篇抓取成功 → ${ARTICLES_DIR}/`);

    if (shouldParse && count > 0) {
      await runParseDir();
    } else if (count > 0) {
      console.log("💡 下一步: npm run crawl -- --dir articles/");
    }
    return;
  }

  // no args
  console.log("💡 用法: npm run fetch -- --help");
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
