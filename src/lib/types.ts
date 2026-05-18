export interface MatchEvent {
  id: string;
  title: string;
  category: Category;
  campus: Campus;
  event_date: string;
  deadline: string;
  location: string;
  original_url: string;
  summary: string;
  is_official: boolean;
  created_at: string;
  source?: string;
}

export type Category = "ball" | "track" | "water" | "other";
export type Campus =
  | "zijingang"
  | "yuquan"
  | "xixi"
  | "huajiachi"
  | "zhoushan"
  | "haining";

export const CATEGORY_LABELS: Record<Category, string> = {
  ball: "球类",
  track: "田径",
  water: "水上",
  other: "其他",
};

export const CAMPUS_LABELS: Record<Campus, string> = {
  zijingang: "紫金港",
  yuquan: "玉泉",
  xixi: "西溪",
  huajiachi: "华家池",
  zhoushan: "舟山",
  haining: "海宁",
};

export const CATEGORY_COLORS: Record<Category, string> = {
  ball: "bg-orange-100 text-orange-700",
  track: "bg-green-100 text-green-700",
  water: "bg-cyan-100 text-cyan-700",
  other: "bg-purple-100 text-purple-700",
};
