"use client";

import { useMemo, useState } from "react";
import { mockEvents } from "@/lib/mockData";
import crawledEvents from "@/data/events.json";
import { Category, Campus, MatchEvent } from "@/lib/types";
import FilterBar from "@/components/FilterBar";
import EventCard from "@/components/EventCard";
import EmptyState from "@/components/EmptyState";
import DailyBriefing from "@/components/DailyBriefing";
import { Trophy, Activity } from "lucide-react";

function mergeEvents(mock: MatchEvent[], crawled: MatchEvent[]): MatchEvent[] {
  const titles = new Set(mock.map((e) => e.title));
  const newEvents = crawled.filter((e) => !titles.has(e.title));
  return [...newEvents, ...mock];
}

export default function HomePage() {
  const [campus, setCampus] = useState<Campus | "all">("all");
  const [category, setCategory] = useState<Category | "all">("all");

  const allEvents = useMemo(() => mergeEvents(mockEvents, crawledEvents as MatchEvent[]), []);

  const filtered = useMemo(() => {
    return allEvents
      .filter((e) => campus === "all" || e.campus === campus)
      .filter((e) => category === "all" || e.category === category)
      .sort(
        (a, b) =>
          new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      );
  }, [campus, category, allEvents]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <header className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-zju-blue">
              <Activity size={24} />
              ZJU Sports Hub
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">浙大体育赛事聚合平台</p>
          </div>
          <DailyBriefing events={filtered} />
        </div>
      </header>

      {/* Filters */}
      <FilterBar
        selectedCampus={campus}
        selectedCategory={category}
        onCampusChange={setCampus}
        onCategoryChange={setCategory}
      />

      {/* Stats */}
      <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
        <Trophy size={14} />
        共 {filtered.length} 个赛事
      </div>

      {/* Event List */}
      <div className="mt-4 space-y-3">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          filtered.map((event) => <EventCard key={event.id} event={event} />)
        )}
      </div>

      {/* Footer */}
      <footer className="mt-8 border-t border-gray-100 pt-6 text-center text-xs text-gray-300">
        ZJU Sports Hub MVP · 数据来源于各公众号公开推文 · 仅供参考
      </footer>
    </div>
  );
}
