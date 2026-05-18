"use client";

import { CATEGORY_LABELS, CAMPUS_LABELS, Category, Campus } from "@/lib/types";

interface Props {
  selectedCampus: Campus | "all";
  selectedCategory: Category | "all";
  onCampusChange: (c: Campus | "all") => void;
  onCategoryChange: (c: Category | "all") => void;
}

const CAMPUS_OPTIONS: { value: Campus | "all"; label: string }[] = [
  { value: "all", label: "全部校区" },
  ...Object.entries(CAMPUS_LABELS).map(([value, label]) => ({
    value: value as Campus,
    label,
  })),
];

const CATEGORY_OPTIONS: { value: Category | "all"; label: string }[] = [
  { value: "all", label: "全部类别" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
    value: value as Category,
    label,
  })),
];

export default function FilterBar({
  selectedCampus,
  selectedCategory,
  onCampusChange,
  onCategoryChange,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {CAMPUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onCampusChange(opt.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              selectedCampus === opt.value ? "tab-active" : "tab-inactive"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {CATEGORY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onCategoryChange(opt.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              selectedCategory === opt.value ? "tab-active" : "tab-inactive"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
