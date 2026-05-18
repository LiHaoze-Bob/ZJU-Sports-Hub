/**
 * 用 headless Chrome 自动跟随搜狗跳转，获取真实的 mp.weixin.qq.com URL
 *
 * 用法：npm run resolve -- --account "浙大体育与艺术"
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { addExtra } from "puppeteer-extra";
import puppeteer from "puppeteer-core";
import type { Page } from "puppeteer-core";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as cheerio from "cheerio";

const pptr = addExtra(puppeteer);
pptr.use(StealthPlugin());
import fs from "node:fs";
import path from "node:path";
import { TARGET_SOURCES, WechatSource } from "../src/lib/sources";

const CHROME_PATH =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URLS_FILE = path.resolve(__dirname, "../urls.txt");

interface ArticleEntry {
  title: string;
  sogouUrl: string;
  accountName: string;
  date: string;
}

async function searchSogouHTML(account: WechatSource): Promise<string> {
  const query = encodeURIComponent(account.name);
  const url = `https://weixin.sogou.com/weixin?type=2&query=${query}&ie=utf8`;

  const resp = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  });
  return resp.text();
}

function extractArticles(html: string, accountName: string): ArticleEntry[] {
  const $ = cheerio.load(html);
  const results: ArticleEntry[] = [];

  $("a[uigs^='article_title']").each((_, el) => {
    const $el = $(el);
    const title = $el.text().trim().replace(/\s+/g, " ");
    const href = $el.attr("href") || "";

    if (title && href && href.includes("/link?")) {
      const $parent = $el.parent();
      const date =
        $parent.find(".s2, .time").text().trim() ||
        $parent.parent().find(".s2, .time").text().trim();

      results.push({
        title,
        sogouUrl: href.startsWith("http") ? href : `https://weixin.sogou.com${href}`,
        accountName,
        date,
      });
    }
  });

  return results;
}

async function resolveRealURL(
  page: Page,
  sogouUrl: string
): Promise<string | null> {
  try {
    await page.goto(sogouUrl, { waitUntil: "networkidle2", timeout: 15000 });
    // The browser follows Sogou redirects and lands on the real page
    const finalUrl = page.url();

    if (finalUrl.includes("mp.weixin.qq.com/s/")) {
      // Clean the URL (remove query params after the path)
      const match = finalUrl.match(/(https?:\/\/mp\.weixin\.qq\.com\/s\/[^?#]+)/);
      return match ? match[1] : finalUrl;
    }

    if (finalUrl.includes("antispider")) {
      console.warn("   ⚠️ 触发反爬，等待重试...");
      return null;
    }

    return null;
  } catch (err) {
    console.warn(`   ❌ 跳转失败: ${(err as Error).message}`);
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
用法: npm run resolve -- --account "浙大体育与艺术"
      npm run resolve -- --all
`);
    return;
  }

  // Select accounts
  let accounts: WechatSource[] = [];
  const idx = args.indexOf("--account");

  if (args.includes("--all")) {
    accounts = TARGET_SOURCES;
  } else if (idx !== -1 && args[idx + 1]) {
    const found = TARGET_SOURCES.find((s) => s.name === args[idx + 1]);
    if (!found) {
      console.error("未找到公众号:", args[idx + 1]);
      process.exit(1);
    }
    accounts = [found];
  } else {
    console.log("用法: npm run resolve -- --account \"浙大体育与艺术\"");
    process.exit(0);
  }

  // Phase 1: Search
  console.log("🔍 搜索公众号文章...\n");
  const allArticles: ArticleEntry[] = [];

  for (const account of accounts) {
    console.log(`   ${account.name}`);
    try {
      const html = await searchSogouHTML(account);
      const articles = extractArticles(html, account.name);
      console.log(`   → 找到 ${articles.length} 篇`);
      allArticles.push(...articles);
    } catch (err) {
      console.warn(`   ⚠️ ${(err as Error).message}`);
    }
  }

  if (allArticles.length === 0) {
    console.log("\n😔 未搜到文章");
    process.exit(0);
  }

  // Filter to sports-related articles by keyword
  const sportsKeywords = [
    "赛", "杯", "比赛", "体育", "运动", "篮球", "足球", "排球", "网球", "羽毛球",
    "乒乓", "游泳", "田径", "越野", "皮划艇", "体能", "健身", "三好杯", "锦标赛",
    "运动会", "报名", "联赛", "积分赛", "春季杯",
  ];

  const sportsArticles = allArticles.filter((a) =>
    sportsKeywords.some((kw) => a.title.includes(kw))
  );

  console.log(`\n🏅 筛选出 ${sportsArticles.length} 篇体育相关文章\n`);

  if (sportsArticles.length === 0) {
    console.log("没有体育相关的文章");
    process.exit(0);
  }

  // Phase 2: Launch browser and resolve URLs
  console.log("🌐 启动 Chrome 获取真实链接...\n");

  const browser = await pptr.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  );

  const resolved: { title: string; url: string; account: string }[] = [];

  for (const article of sportsArticles) {
    console.log(`   🔗 ${article.title.slice(0, 50)}...`);
    const realUrl = await resolveRealURL(page, article.sogouUrl);

    if (realUrl) {
      console.log(`   ✅ ${realUrl}`);
      resolved.push({
        title: article.title,
        url: realUrl,
        account: article.accountName,
      });
    } else {
      console.log(`   ⚠️ 未获取到真实链接`);
    }

    await sleep(3000); // Polite delay
  }

  await browser.close();

  // Phase 3: Save to urls.txt
  if (resolved.length > 0) {
    const existing = new Set<string>();
    if (fs.existsSync(URLS_FILE)) {
      fs.readFileSync(URLS_FILE, "utf-8")
        .split("\n")
        .filter((l) => l.includes("mp.weixin.qq.com"))
        .forEach((l) => existing.add(l.trim()));
    }

    const newUrls = resolved.filter((r) => !existing.has(r.url));
    const lines = [
      "# ZJU Sports Hub — 自动解析的文章链接",
      `# 解析时间: ${new Date().toISOString()}`,
      "",
    ];

    for (const r of newUrls) {
      lines.push(`# ${r.account}: ${r.title}`);
      lines.push(r.url);
      lines.push("");
    }

    // Append to urls.txt
    const content =
      (fs.existsSync(URLS_FILE) ? fs.readFileSync(URLS_FILE, "utf-8") + "\n" : "") +
      lines.join("\n");
    fs.writeFileSync(URLS_FILE, content, "utf-8");

    console.log(`\n✅ ${newUrls.length} 个新链接已追加到 urls.txt`);
    console.log("💡 下一步: npm run fetch -- --urls urls.txt --parse");
  } else {
    console.log("\n😔 未能获取到任何真实链接");
    console.log("💡 搜狗反爬可能较严格，建议手动复制链接");
  }
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
