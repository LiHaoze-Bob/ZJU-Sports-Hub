/**
 * ZJU Sports Hub — 自动发现微信文章链接
 *
 * 用法：
 *   npx tsx scripts/discover.ts             列出所有目标公众号近期文章（不点击）
 *   npx tsx scripts/discover.ts --click     自动收集真实链接并写入 urls.txt
 *   npx tsx scripts/discover.ts --days 5    只收集最近 5 天的文章（默认 7 天）
 *
 * 说明：
 *   使用可见 Chrome 浏览器窗口操作搜狗微信搜索。
 *   浏览器 cookie 持久化到 .chrome-profile 目录，
 *   多次运行后搜狗会将你识别为正常用户，反爬概率逐步降低。
 *
 *   每个搜索结果都会：
 *   1. 按公众号名称精确过滤（只保留 targets.md 中的目标公众号）
 *   2. 按发布时间过滤（只保留最近 N 天的文章）
 */

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "node:fs";
import path from "node:path";
import { TARGET_SOURCES } from "../src/lib/sources";

puppeteer.use(StealthPlugin());

const CHROME_PATH =
  process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE_DIR = path.resolve(__dirname, "../.chrome-profile");
const URLS_FILE = path.resolve(__dirname, "../urls.txt");
const WEBMD_FILE = path.resolve(__dirname, "../web.md");

const AUTO_CLICK = process.argv.includes("--click");

// Parse --days argument
const daysIdx = process.argv.indexOf("--days");
const MAX_AGE_DAYS = daysIdx !== -1 ? parseInt(process.argv[daysIdx + 1], 10) || 7 : 7;

interface SearchResult {
  title: string;
  accountName: string;
  /** Unix timestamp in seconds */
  ts: number;
  sogouLink: string;
  valid: boolean;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Extract article metadata from each search result <li> on the Sogou page.
 * We run this inside the browser via page.$$eval on the <li> elements.
 */
function extractResultsFromDOM(lis: Element[]): SearchResult[] {
  return lis.map((li) => {
    const titleEl = li.querySelector("h3 a");
    const title = titleEl?.textContent?.trim() || "";
    const sogouLink = titleEl?.getAttribute("href") || "";

    const accountEl = li.querySelector(".all-time-y2");
    const accountName = accountEl?.textContent?.trim() || "";

    // Extract timestamp from <script>document.write(timeConvert('1234567890'))</script>
    const scriptEl = li.querySelector(".s2 script");
    let ts = 0;
    if (scriptEl) {
      const match = scriptEl.textContent?.match(/timeConvert\('(\d+)'\)/);
      if (match) ts = parseInt(match[1], 10);
    }

    return { title, accountName, ts, sogouLink, valid: false };
  });
}

function isTargetAccount(accountName: string): boolean {
  return TARGET_SOURCES.some((s) => s.name === accountName);
}

function formatDate(tsSec: number): string {
  return new Date(tsSec * 1000).toISOString().slice(0, 10);
}

async function discover() {
  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - MAX_AGE_DAYS * 86400;

  console.log("🚀 启动 Chrome 浏览器...");
  console.log(`   日期范围: 最近 ${MAX_AGE_DAYS} 天`);
  console.log(`   模式: ${AUTO_CLICK ? "自动点击收集链接" : "仅搜索展示结果"}`);
  console.log(`   Chrome: ${CHROME_PATH}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    userDataDir: PROFILE_DIR,
    args: ["--no-first-run", "--no-default-browser-check", "--window-size=1280,900"],
  });

  const allUrls = new Set<string>();
  const allResults: { account: string; title: string; date: string; url?: string }[] = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    for (const source of TARGET_SOURCES) {
      const query = source.name;
      const searchUrl = `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(query)}`;

      console.log(`🔍 ${query}`);
      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await sleep(2000);

      // Check for antispider
      if (page.url().includes("antispider")) {
        console.log(`   ⚠️ 搜索页触发验证，请在浏览器中手动完成验证，然后按 Enter 继续...`);
        await waitForEnter();
        await sleep(1000);
      }

      if (!page.url().includes("weixin.sogou.com/weixin")) {
        await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 15000 });
        await sleep(2000);
      }

      // Parse all search result <li> items
      const results = await page.$$eval(
        'li[id^="sogou_vr_"]',
        extractResultsFromDOM
      );

      // Filter: must be from the target account AND within date range
      const valid = results.filter((r) => {
        if (!isTargetAccount(r.accountName)) return false;
        if (r.ts > 0 && r.ts < cutoff) return false;
        return true;
      });

      console.log(`   📎 ${results.length} 条搜索结果`);
      console.log(`   ✅ ${valid.length} 条符合条件（${source.name} + 最近${MAX_AGE_DAYS}天）`);

      for (const r of valid) {
        const dateStr = r.ts > 0 ? formatDate(r.ts) : "未知日期";
        console.log(`      📅 ${dateStr} | ${r.title.slice(0, 60)}`);

        if (AUTO_CLICK) {
          try {
            const redirectUrl = `https://weixin.sogou.com${r.sogouLink}`;
            await page.goto(redirectUrl, { waitUntil: "networkidle2", timeout: 15000 });
            await sleep(2000 + Math.random() * 1000);

            const finalUrl = page.url();
            if (finalUrl.includes("mp.weixin.qq.com/s/")) {
              const clean = finalUrl.split("?")[0];
              allUrls.add(clean);
              console.log(`         🔗 ${clean}`);
              allResults.push({
                account: r.accountName,
                title: r.title,
                date: dateStr,
                url: clean,
              });
            } else if (finalUrl.includes("antispider")) {
              console.log(`         ⚠️ 触发反爬，跳过`);
              allResults.push({
                account: r.accountName,
                title: r.title,
                date: dateStr,
              });
            }
          } catch (err) {
            console.log(`         ❌ ${(err as Error).message}`);
          }

          // Human-like delay between clicks
          await sleep(1500 + Math.random() * 2500);
        } else {
          allResults.push({
            account: r.accountName,
            title: r.title,
            date: dateStr,
          });
        }
      }

      if (!AUTO_CLICK) {
        // Show top non-click results
        console.log(`   ─────────────────────`);
      }
      console.log();
    }
  } finally {
    await browser.close();
  }

  // ── Summary ──
  console.log("═══════════════════════════════════════");
  if (AUTO_CLICK) {
    const urls = [...allUrls].sort();
    if (urls.length > 0) {
      fs.writeFileSync(URLS_FILE, urls.join("\n") + "\n", "utf-8");
      fs.writeFileSync(WEBMD_FILE, urls.join("\n") + "\n", "utf-8");
      console.log(`✅ 收集到 ${urls.length} 个链接`);
      console.log(`   已保存: urls.txt + web.md`);
      console.log(`\n📊 按公众号统计:`);
      const byAccount = new Map<string, number>();
      for (const r of allResults) if (r.url) byAccount.set(r.account, (byAccount.get(r.account) || 0) + 1);
      for (const [name, count] of byAccount) {
        console.log(`   ${name}: ${count} 篇`);
      }
      console.log(`\n下一步: npm run fetch -- --urls urls.txt --parse`);
    } else {
      console.log("💡 未收集到链接。可能原因：");
      console.log("   1. 近期该公众号未发布文章");
      console.log("   2. 反爬验证拦截（可稍后重试）");
      console.log(`   3. 尝试扩大日期范围: --days ${MAX_AGE_DAYS + 5}`);
    }
  } else {
    // Group by account for preview
    const byAccount = new Map<string, typeof allResults>();
    for (const r of allResults) {
      if (!byAccount.has(r.account)) byAccount.set(r.account, []);
      byAccount.get(r.account)!.push(r);
    }
    for (const [name, items] of byAccount) {
      console.log(`\n📋 ${name} (${items.length} 篇):`);
      for (const item of items) {
        console.log(`   ${item.date}  ${item.title.slice(0, 50)}`);
      }
    }
    if (allResults.length > 0) {
      console.log(`\n💡 使用 --click 自动收集真实链接: npx tsx scripts/discover.ts --click`);
    } else {
      console.log(`\n💡 未找到近期文章。尝试扩大范围: npx tsx scripts/discover.ts --days ${MAX_AGE_DAYS + 5}`);
    }
  }
}

async function waitForEnter() {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<void>((resolve) => {
    rl.question("", () => {
      rl.close();
      resolve();
    });
  });
}

discover().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
