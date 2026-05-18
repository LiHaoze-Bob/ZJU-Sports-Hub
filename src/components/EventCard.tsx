import { MatchEvent, CATEGORY_LABELS, CAMPUS_LABELS, CATEGORY_COLORS } from "@/lib/types";
import CountdownBadge from "./CountdownBadge";
import { MapPin, Award, Calendar, User, ExternalLink } from "lucide-react";

export default function EventCard({ event }: { event: MatchEvent }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex-1 text-base font-semibold text-gray-900 leading-snug">
          {event.title}
        </h3>
        <CountdownBadge deadline={event.deadline} />
      </div>

      <p className="mt-2 text-sm text-gray-500 line-clamp-2">{event.summary}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium ${CATEGORY_COLORS[event.category]}`}>
          {CATEGORY_LABELS[event.category]}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
          {CAMPUS_LABELS[event.campus]}
        </span>
        {event.is_official && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-zju-gold/20 px-2 py-0.5 font-medium text-zju-gold">
            <Award size={12} />
            二课/综素
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1">
          <Calendar size={12} />
          {event.event_date}
        </span>
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} />
          {event.location}
        </span>
        {event.source && (
          <span className="inline-flex items-center gap-1">
            <User size={12} />
            {event.source}
          </span>
        )}
      </div>

      {event.original_url && (
        <a
          href={event.original_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-zju-blue hover:underline"
        >
          <ExternalLink size={12} />
          查看原文
        </a>
      )}
    </div>
  );
}
