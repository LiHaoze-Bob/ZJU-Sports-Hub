"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

function calcRemainder(deadline: string): {
  totalHours: number;
  text: string;
  urgent: boolean;
} {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end.getTime() - now.getTime();

  if (diff <= 0) {
    return { totalHours: 0, text: "已截止", urgent: false };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const totalHours = Math.floor(diff / (1000 * 60 * 60));

  if (days > 0) {
    return { totalHours, text: `还剩 ${days} 天`, urgent: days <= 3 };
  }
  if (hours > 0) {
    return { totalHours, text: `还剩 ${hours} 小时`, urgent: true };
  }
  return { totalHours, text: "即将截止", urgent: true };
}

export default function CountdownBadge({ deadline }: { deadline: string }) {
  const [remainder, setRemainder] = useState(() => calcRemainder(deadline));

  useEffect(() => {
    const tick = () => setRemainder(calcRemainder(deadline));
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [deadline]);

  if (remainder.text === "已截止") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <Clock size={12} />
        已截止
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        remainder.urgent
          ? "bg-red-50 text-red-600 animate-pulse"
          : "bg-zju-blue-bg text-zju-blue"
      }`}
    >
      <Clock size={12} />
      {remainder.text}
    </span>
  );
}
