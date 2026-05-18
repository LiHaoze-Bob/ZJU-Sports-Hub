"use client";

import { useState } from "react";
import { MatchEvent, CATEGORY_LABELS, CAMPUS_LABELS } from "@/lib/types";
import { Share2, Copy, Check, Newspaper } from "lucide-react";

function buildBriefing(events: MatchEvent[]): string {
  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const lines: string[] = [
    `🏅 浙大体育早报 | ${today}`,
    "",
  ];

  if (events.length === 0) {
    lines.push("今日暂无新增赛事信息。");
    lines.push("如需查看往期赛事，请访问 ZJU Sports Hub。");
    return lines.join("\n");
  }

  lines.push(`今日共收录 ${events.length} 条赛事动态：`);
  lines.push("");

  events.forEach((e, i) => {
    const deadline = new Date(e.deadline);
    const daysLeft = Math.ceil(
      (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const tag = e.is_official ? " [二课/综素]" : "";
    lines.push(
      `${i + 1}. ${e.title}${tag} | ${CATEGORY_LABELS[e.category]} | ${CAMPUS_LABELS[e.campus]} | 截止: ${e.deadline}（${daysLeft > 0 ? `剩${daysLeft}天` : "已截止"}）`
    );
  });

  lines.push("");
  lines.push("📱 更多赛事详情请访问 ZJU Sports Hub");

  return lines.join("\n");
}

export default function DailyBriefing({ events }: { events: MatchEvent[] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const briefing = buildBriefing(events);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(briefing);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ text: briefing });
    } else {
      setOpen(true);
    }
  };

  return (
    <>
      <button
        onClick={handleShare}
        className="inline-flex items-center gap-1.5 rounded-full bg-zju-gold px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
      >
        <Newspaper size={16} />
        今日体育早报
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">今日体育早报</h3>
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1 rounded-lg bg-zju-blue-bg px-3 py-1.5 text-sm font-medium text-zju-blue transition-colors hover:bg-zju-blue/10"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "已复制" : "复制"}
              </button>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700 leading-relaxed max-h-64 overflow-y-auto">
              {briefing}
            </pre>
            <p className="mt-3 text-xs text-gray-400">
              复制文本后可直接分享至微信/QQ/钉钉
            </p>
            <button
              onClick={() => setOpen(false)}
              className="mt-4 w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </>
  );
}
