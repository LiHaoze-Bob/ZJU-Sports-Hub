import { MatchEvent } from "./types";

/**
 * Repair common LLM JSON mistakes: unescaped double quotes inside string values.
 * "key": "value with "unescaped" quotes" → "key": "value with \"unescaped\" quotes"
 */
function repairJSON(json: string): string {
  const result: string[] = [];
  let inString = false;
  let inKey = false;
  let keyDone = false;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    const prev = i > 0 ? json[i - 1] : "";

    if (ch === '"' && prev !== "\\") {
      if (!inString) {
        inString = true;
        inKey = !keyDone;
      } else {
        // Look ahead to see if this quote closes the string
        const after = json.slice(i + 1);
        const nextNonSpace = after.match(/^[ \t\r\n]*([,:}\]])/);
        if (nextNonSpace) {
          // This quote is followed by , : } or ], so it closes the string
          inString = false;
          if (inKey) {
            keyDone = true;
          } else {
            keyDone = false;
          }
        } else {
          // This quote is inside a string value — escape it
          result.push("\\");
        }
      }
    }

    if (!inString && (ch === "," || ch === "}" || ch === "]")) {
      keyDone = false;
      inKey = false;
    }
    if (!inString && ch === ":") {
      keyDone = true;
      inKey = false;
    }

    result.push(ch);
  }

  return result.join("");
}

const SYSTEM_PROMPT = `你是一个专门为浙江大学体育赛事信息平台工作的数据提取助手。你的任务是从微信公众号推文文本中提取结构化的体育赛事信息。

要求：
1. 严格去重：如果多条文本指向同一赛事，只保留一条。
2. 排除非体育赛事：如讲座、文艺活动、学术会议等非体育内容直接跳过。
3. 输出格式必须是严格的 JSON 数组，每个元素包含以下字段：
   - title: 赛事标题（string，内部如有引号请用「」替代）
   - category: 赛事类别，必须是 "ball"（球类）、"track"（田径）、"water"（水上）、"other"（其他）之一
   - campus: 校区，必须是 "zijingang"（紫金港）、"yuquan"（玉泉）、"xixi"（西溪）、"huajiachi"（华家池）、"zhoushan"（舟山）、"haining"（海宁）之一
   - event_date: 比赛日期，格式 YYYY-MM-DD（string）
   - deadline: 报名截止日期，格式 YYYY-MM-DD，如无明确截止日期则填比赛日期前7天（string）
   - location: 比赛地点（string）
   - summary: 赛事简介，50-100字（string）
   - is_official: 是否明确标注带二课分或综素加分（boolean）

重要：JSON 字符串值内部出现的双引号必须转义为 \\"，如 "title": "关于举办\\"三好杯\\"篮球赛的通知"
如果文本中没有体育赛事信息，返回空数组 []。
只返回 JSON 数组，不要包含 markdown 代码块标记，不要包含其他任何内容。`;

interface LLMConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export async function parseArticleWithLLM(
  content: string,
  config: LLMConfig
): Promise<MatchEvent[]> {
  const { apiKey, baseUrl = "https://api.openai.com/v1", model = "gpt-4o-mini" } = config;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `请从以下推文内容中提取体育赛事信息：\n\n${content}` },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;

  if (!raw) {
    throw new Error("LLM returned empty response");
  }

  // Extract JSON array from the response (handle markdown code fences)
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.warn("LLM raw response:", raw.slice(0, 500));
    return [];
  }

  let jsonStr = jsonMatch[0];

  // Remove trailing commas (common LLM mistake)
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, "$1");

  let parsed: MatchEvent[];
  try {
    parsed = JSON.parse(jsonStr) as MatchEvent[];
  } catch {
    // Retry with repair: unescape internal double quotes in string values
    const repaired = repairJSON(jsonStr);
    try {
      parsed = JSON.parse(repaired) as MatchEvent[];
    } catch (err2) {
      console.error("JSON parse error after repair. Raw (first 500 chars):", jsonStr.slice(0, 500));
      throw err2;
    }
  }

  // Generate IDs for each event
  const now = new Date().toISOString();
  return parsed.map((event, index) => ({
    ...event,
    id: `llm-${Date.now()}-${index}`,
    original_url: "",
    created_at: now,
  }));
}

/**
 * Simulated parser for MVP demo — returns mock data.
 * Replace with real parseArticleWithLLM when you have an API key.
 */
export async function processArticle(content: string): Promise<MatchEvent[]> {
  // In MVP, simulate by returning a filtered subset of mock data
  // that matches keywords found in the content.
  const { mockEvents } = await import("./mockData");

  const keywords = content.toLowerCase();
  const matched = mockEvents.filter((e) => {
    return (
      keywords.includes(e.title.slice(0, 4)) ||
      keywords.includes(e.category) ||
      keywords.includes(e.campus)
    );
  });

  // If no match, return first 2 as demo
  if (matched.length === 0) {
    return mockEvents.slice(0, 2).map((e) => ({
      ...e,
      id: `parsed-${Date.now()}-${e.id}`,
    }));
  }

  return matched.map((e) => ({
    ...e,
    id: `parsed-${Date.now()}-${e.id}`,
  }));
}
