import { NextRequest, NextResponse } from "next/server";
import { processArticle, parseArticleWithLLM } from "@/lib/llmParser";

export async function POST(request: NextRequest) {
  try {
    const { content, useLLM } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'content' field" },
        { status: 400 }
      );
    }

    if (useLLM) {
      const apiKey = process.env.LLM_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "LLM_API_KEY environment variable not set" },
          { status: 500 }
        );
      }

      const events = await parseArticleWithLLM(content, {
        apiKey,
        baseUrl: process.env.LLM_BASE_URL,
        model: process.env.LLM_MODEL,
      });

      return NextResponse.json({ events });
    }

    // MVP mode: keyword-based simulation
    const events = await processArticle(content);
    return NextResponse.json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
