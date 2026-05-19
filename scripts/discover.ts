/**
 * ZJU Sports Hub — 自动发现微信文章链接
 *
 * 用法：
 *   npx tsx scripts/discover.ts             仅搜索展示（不触发反爬）
 *   npx tsx scripts/discover.ts --click     自动点击链接收集真实 URL
 *
 * 说明：
 *   使用可见的 Chrome 浏览器窗口操作搜狗微信搜索。
 *   浏览器配置（cookie 等）会持久化到 .chrome-profile 目录，
 *   多次运行后搜狗会将你识别为正常用户，反爬概率逐步降低。
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

const MAX_RESULTS_PER_ACCOUNT = 10;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function discover(autoClick: boolean) {
  console.log("🚀 启动 Chrome 浏览器...");
  console.log(`   模式: ${autoClick ? "自动点击收集链接" : "仅搜索展示结果"}`);
  console.log(`   Chrome: ${CHROME_PATH}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    userDataDir: PROFILE_DIR,
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1280,900",
    ],
  });

  const allUrls = new Set<string>();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    for (const source of TARGET_SOURCES) {
      const query = source.name;
      const searchUrl = `https://weixin.sogou.com/weixin?type=2&query=${encodeURIComponent(query)}`;

      console.log(`🔍 ${query}`);
      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });
      await sleep(1500 + Math.random() * 1000);

      // Check for antispider on search page
      if (page.url().includes("antispider")) {
        console.log(`   ⚠️ 搜索页触发验证，请在浏览器中手动完成验证，然后按 Enter 继续...`);
        await waitForEnter();
        // After manual verification, the page may have loaded results
        await sleep(1000);
      }

      // Re-navigate to search if we got redirected
      if (!page.url().includes("weixin.sogou.com/weixin")) {
        await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 15000 });
        await sleep(1000);
      }

      // Extract Sogou redirect links from results
      const sogouLinks = await page.$$eval(
        'a[href*="/link?"]',
        (els) =>
          els.map((el) => ({
            href: el.getAttribute("href") || "",
            text: el.textContent?.trim().slice(0, 60) || "",
          }))
      );

      // Deduplicate by href
      const unique = sogouLinks.filter(
        (l, i, arr) => arr.findIndex((x) => x.href === l.href) === i
      );

      console.log(`   📎 找到 ${unique.length} 条结果`);

      if (autoClick) {
        const count = Math.min(unique.length, MAX_RESULTS_PER_ACCOUNT);
        for (let i = 0; i < count; i++) {
          const link = unique[i];
          console.log(`   [${i + 1}/${count}] ${link.text}`);

          try {
            const redirectUrl = `https://weixin.sogou.com${link.href}`;
            await page.goto(redirectUrl, {
              waitUntil: "networkidle2",
              timeout: 15000,
            });
            await sleep(2000 + Math.random() * 1000);

            const finalUrl = page.url();

            if (finalUrl.includes("mp.weixin.qq.com/s/")) {
              const clean = finalUrl.split("?")[0];
              allUrls.add(clean);
              console.log(`      ✅ ${clean}`);
            } else if (finalUrl.includes("antispider")) {
              console.log(`      ⚠️ 触发了反爬验证，跳过（可稍后重试）`);
            } else {
              console.log(`      ❓ ${finalUrl.slice(0, 80)}`);
            }
          } catch (err) {
            console.log(`      ❌ ${(err as Error).message}`);
          }

          // Small delay between clicks to look human
          await sleep(1000 + Math.random() * 2000);
        }
      } else {
        // Just print the top results
        unique.slice(0, 5).forEach((l, j) => {
          console.log(`   ${j + 1}. ${l.text}`);
        });
      }

      console.log();
    }
  } finally {
    await browser.close();
  }

  // Save
  const urls = [...allUrls].sort();
  if (urls.length > 0) {
    fs.writeFileSync(URLS_FILE, urls.join("\n") + "\n", "utf-8");
    fs.writeFileSync(WEBMD_FILE, urls.join("\n") + "\n", "utf-8");
    console.log(`✅ 收集到 ${urls.length} 个链接`);
    console.log(`   已保存: ${URLS_FILE}`);
    console.log(`   已同步: ${WEBMD_FILE}`);
    console.log(`\n下一步: npm run fetch -- --urls urls.txt --parse`);
  } else if (!autoClick) {
    console.log(`💡 使用 --click 模式自动点击链接收集真实 URL:`);
    console.log(`   npx tsx scripts/discover.ts --click`);
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

const autoClick = process.argv.includes("--click");
discover(autoClick).catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
