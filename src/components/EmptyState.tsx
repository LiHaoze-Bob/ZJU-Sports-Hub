import { CalendarOff } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <CalendarOff size={48} strokeWidth={1.5} />
      <p className="mt-4 text-sm">暂无符合条件的赛事</p>
      <p className="mt-1 text-xs">试试调整筛选条件吧</p>
    </div>
  );
}
