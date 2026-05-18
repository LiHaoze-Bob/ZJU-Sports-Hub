/**
 * ZJU Sports Hub — 推文爬取 & 解析脚本
 *
 * 用法：
 *   npm run crawl -- --file articles/example.txt
 *   npm run crawl -- --dir articles/
 *   echo "推文内容..." | npm run crawl
 *
 * 需要先配置 .env.local 中的 LLM_API_KEY
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";
import { parseArticleWithLLM } from "../src/lib/llmParser";
import { MatchEvent } from "../src/lib/types";

const DATA_FILE = path.resolve(__dirname, "../src/data/events.json");
const ARTICLES_DIR = path.resolve(__dirname, "../articles");

// ---------- helpers ----------

function loadExistingEvents(): MatchEvent[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw) as MatchEvent[];
    }
  } catch {
    console.warn("⚠️  无法读取现有 events.json，将创建新文件");
  }
  return [];
}

function saveEvents(events: MatchEvent[]): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(events, null, 2), "utf-8");
  console.log(`✅ 已保存 ${events.length} 条赛事到 ${DATA_FILE}`);
}

function deduplicate(existing: MatchEvent[], incoming: MatchEvent[]): MatchEvent[] {
  const titles = new Set(existing.map((e) => e.title));
  const newEvents = incoming.filter((e) => !titles.has(e.title));
  if (newEvents.length < incoming.length) {
    console.log(`🔁 去重：跳过 ${incoming.length - newEvents.length} 条重复赛事`);
  }
  return [...existing, ...newEvents];
}

// ---------- LLM config ----------

function getLLMConfig() {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey || apiKey === "sk-your-deepseek-api-key") {
    console.error("❌ 请先在 .env.local 中设置 LLM_API_KEY");
    process.exit(1);
  }
  return {
    apiKey,
    baseUrl: process.env.LLM_BASE_URL || "https://api.deepseek.com/v1",
    model: process.env.LLM_MODEL || "deepseek-chat",
  };
}

// ---------- process single article ----------

async function processArticle(content: string): Promise<MatchEvent[]> {
  const config = getLLMConfig();
  console.log(`🤖 正在调用 ${config.model} 解析推文...`);
  const events = await parseArticleWithLLM(content, config);
  console.log(`📋 提取到 ${events.length} 条赛事`);
  return events;
}

// ---------- process file ----------

async function processFile(filePath: string): Promise<MatchEvent[]> {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ 文件不存在: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath, "utf-8").trim();
  if (!content) {
    console.warn(`⚠️  文件为空: ${filePath}`);
    return [];
  }
  console.log(`📄 读取文件: ${path.basename(filePath)} (${content.length} 字符)`);
  return processArticle(content);
}

// ---------- process directory ----------

async function processDir(dirPath: string): Promise<MatchEvent[]> {
  if (!fs.existsSync(dirPath)) {
    console.error(`❌ 目录不存在: ${dirPath}`);
    return [];
  }
  const files = fs
    .readdirSync(dirPath)
    .filter((f) => f.endsWith(".txt"))
    .map((f) => path.join(dirPath, f));

  if (files.length === 0) {
    console.warn(`⚠️  目录 ${dirPath} 中没有 .txt 文件`);
    return [];
  }

  console.log(`📂 发现 ${files.length} 个文件待处理\n`);
  const allEvents: MatchEvent[] = [];
  for (const file of files) {
    const events = await processFile(file);
    allEvents.push(...events);
  }
  return allEvents;
}

// ---------- main ----------

async function main() {
  const args = process.argv.slice(2);
  let incoming: MatchEvent[] = [];

  // Read from stdin (piped content)
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    const content = Buffer.concat(chunks).toString("utf-8").trim();
    if (content) {
      console.log(`📥 从 stdin 读取 (${content.length} 字符)`);
      incoming = await processArticle(content);
    }
  }

  // --file mode
  const fileIdx = args.indexOf("--file");
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    incoming = await processFile(args[fileIdx + 1]);
  }

  // --dir mode
  const dirIdx = args.indexOf("--dir");
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    incoming = await processDir(args[dirIdx + 1]);
  }

  // --help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
ZJU Sports Hub — 推文解析脚本

用法:
  npm run crawl -- --file articles/三好杯篮球赛.txt   解析单个文件
  npm run crawl -- --dir articles/                      批量解析目录下所有 .txt 文件
  echo "推文内容..." | npm run crawl                     管道输入

输出:
  解析结果保存至 src/data/events.json（自动去重）

配置:
  在 .env.local 中设置 LLM_API_KEY（DeepSeek 或 OpenAI）
`);
    return;
  }

  if (incoming.length === 0) {
    console.log("💡 未提供输入。用法：npm run crawl -- --file <路径>  或  echo '内容' | npm run crawl");
    console.log("   查看帮助：npm run crawl -- --help");
    return;
  }

  // Merge with existing, deduplicate, save
  const existing = loadExistingEvents();
  const merged = deduplicate(existing, incoming);
  saveEvents(merged);

  // Print summary
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  incoming.forEach((e, i) => {
    console.log(`  ${i + 1}. ${e.title}`);
    console.log(`     🏷 ${e.category} | 📍 ${e.campus} | 📅 ${e.event_date} | ⏰ 截止 ${e.deadline}`);
    console.log(`     ${e.is_official ? "✅ 二课/综素" : "○ 无加分"}`);
  });
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((err) => {
  console.error("❌ 脚本错误:", err.message);
  process.exit(1);
});
