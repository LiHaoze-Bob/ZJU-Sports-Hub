import { MatchEvent } from "./types";

// ---------- dynamic date helpers ----------
function d(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

function iso(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

// ---------- template (offsets relative to today) ----------
interface Template {
  title: string;
  category: MatchEvent["category"];
  campus: MatchEvent["campus"];
  eventDateOffset: number;
  deadlineOffset: number;
  location: string;
  originalUrl: string;
  summary: string;
  isOfficial: boolean;
  source?: string;
}

const Y = new Date().getFullYear();

const templates: Template[] = [
  {
    title: `${Y}年「三好杯」本科生篮球赛`,
    category: "ball",
    campus: "zijingang",
    eventDateOffset: 25,
    deadlineOffset: 18,
    location: "紫金港校区灯光球场",
    originalUrl: "https://mp.weixin.qq.com/s/example1",
    summary: `浙江大学${Y}年三好杯本科生篮球赛即将开赛，以院系为单位组队报名，每队限报12人。比赛采用小组赛+淘汰赛制，冠军队将代表学校参加省大学生篮球联赛。`,
    isOfficial: true,
    source: "浙大篮联",
  },
  {
    title: `${Y}年浙江大学田径运动会`,
    category: "track",
    campus: "zijingang",
    eventDateOffset: 90,
    deadlineOffset: 70,
    location: "紫金港校区东田径场",
    originalUrl: "https://mp.weixin.qq.com/s/example2",
    summary: `浙江大学${Y}年田径运动会将于10月举行。设男/女子100m、200m、400m、800m、1500m、4×100m接力、跳高、跳远、铅球等项目。各院系限报运动员30人。`,
    isOfficial: true,
    source: "浙大体育与艺术",
  },
  {
    title: `${Y}年「三好杯」游泳锦标赛`,
    category: "water",
    campus: "yuquan",
    eventDateOffset: 35,
    deadlineOffset: 28,
    location: "玉泉校区游泳池",
    originalUrl: "https://mp.weixin.qq.com/s/example3",
    summary:
      "三好杯游泳锦标赛设自由泳、蛙泳、仰泳、蝶泳及混合泳接力等项目。分本科生组和研究生组，个人项目每人限报2项。",
    isOfficial: true,
    source: "浙大体育与艺术",
  },
  {
    title: `${Y}年「三好杯」足球赛`,
    category: "ball",
    campus: "zijingang",
    eventDateOffset: 60,
    deadlineOffset: 50,
    location: "紫金港校区西田径场",
    originalUrl: "https://mp.weixin.qq.com/s/example4",
    summary:
      "三好杯足球赛采用八人制，每队限报18人。比赛分为小组赛和淘汰赛两个阶段，决赛将在紫金港校区西田径场举行。",
    isOfficial: true,
    source: "浙大足协",
  },
  {
    title: "第六届浙大师生羽毛球混合团体赛",
    category: "ball",
    campus: "xixi",
    eventDateOffset: 14,
    deadlineOffset: 7,
    location: "西溪校区体育馆",
    originalUrl: "https://mp.weixin.qq.com/s/example5",
    summary:
      "师生羽毛球混合团体赛，每队由2名教师+4名学生组成，设男双、女双、混双三个项目。欢迎各院系积极组队参赛。",
    isOfficial: false,
    source: "浙大羽协",
  },
  {
    title: `${Y}年「三好杯」排球赛`,
    category: "ball",
    campus: "yuquan",
    eventDateOffset: 120,
    deadlineOffset: 105,
    location: "玉泉校区体育馆",
    originalUrl: "https://mp.weixin.qq.com/s/example6",
    summary:
      "三好杯排球赛以院系为单位报名，每队6-12人。比赛采用三局两胜制，前两局25分，决胜局15分。",
    isOfficial: true,
    source: "浙大体育与艺术",
  },
  {
    title: "启真湖皮划艇体验活动",
    category: "water",
    campus: "zijingang",
    eventDateOffset: 5,
    deadlineOffset: 2,
    location: "紫金港校区启真湖码头",
    originalUrl: "https://mp.weixin.qq.com/s/example7",
    summary:
      "水上运动俱乐部举办皮划艇体验活动，无需经验，现场有专业教练指导。每次体验30分钟，需提前预约时段。提供所有装备。",
    isOfficial: false,
    source: "浙大体育与艺术",
  },
  {
    title: "研究生乒乓球积分赛（春季站）",
    category: "ball",
    campus: "huajiachi",
    eventDateOffset: 10,
    deadlineOffset: 5,
    location: "华家池校区体育馆乒乓球室",
    originalUrl: "https://mp.weixin.qq.com/s/example8",
    summary:
      "研究生乒乓球积分赛春季站，设男单、女单两个项目。比赛采用11分五局三胜制，取前八名获得积分，积分累计排名将决定年度总决赛资格。",
    isOfficial: false,
    source: "浙大乒协",
  },
  {
    title: `${Y}年「三好杯」网球赛`,
    category: "ball",
    campus: "zijingang",
    eventDateOffset: 80,
    deadlineOffset: 65,
    location: "紫金港校区网球场",
    originalUrl: "https://mp.weixin.qq.com/s/example9",
    summary:
      "三好杯网球赛设男单、女单、男双、混双四个项目。每人限报2项，比赛采用一盘六局平局决胜制。参赛选手需自备球拍。",
    isOfficial: true,
    source: "浙大网协",
  },
  {
    title: "浙大舟山校区定向越野挑战赛",
    category: "track",
    campus: "zhoushan",
    eventDateOffset: 8,
    deadlineOffset: 3,
    location: "舟山校区校园",
    originalUrl: "https://mp.weixin.qq.com/s/example10",
    summary:
      "舟山校区定向越野挑战赛，2人一组，使用地图和指北针在校园内寻找检查点，以用时短者为胜。设男子组、女子组和混合组。",
    isOfficial: false,
    source: "浙大体育与艺术",
  },
];

// ---------- build (called once per import — fresh dates on each dev restart) ----------
function buildEvents(): MatchEvent[] {
  return templates.map((t, i) => ({
    id: String(i + 1),
    title: t.title,
    category: t.category,
    campus: t.campus,
    event_date: d(t.eventDateOffset),
    deadline: d(t.deadlineOffset),
    location: t.location,
    original_url: t.originalUrl,
    summary: t.summary,
    is_official: t.isOfficial,
    created_at: iso(-Math.abs(t.eventDateOffset) - 30),
  }));
}

export const mockEvents: MatchEvent[] = buildEvents();

export function getEvents(): MatchEvent[] {
  return mockEvents;
}

export function getEventById(id: string): MatchEvent | undefined {
  return mockEvents.find((e) => e.id === id);
}
