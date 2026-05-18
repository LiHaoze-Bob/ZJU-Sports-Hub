/**
 * 目标公众号配置
 *
 * 每个公众号对应一个信息源。接入真实爬虫后，
 * 爬虫遍历此列表抓取推文 → 传入 LLM 解析 → 结构化入库。
 */

export interface WechatSource {
  /** 公众号名称 */
  name: string;
  /** 公众号 ID（搜狗微信搜索 / WeRSS 等渠道使用） */
  accountId: string;
  /** 主要覆盖校区（用于提示 LLM） */
  campus: string;
  /** 备注 */
  note?: string;
}

export const TARGET_SOURCES: WechatSource[] = [
  {
    name: "浙大体育与艺术",
    accountId: "gh_zju_sports",
    campus: "all",
    note: "校级官方体育通知，覆盖面最广，三好杯/校运会等主要来源",
  },
  {
    name: "浙大羽协",
    accountId: "gh_zju_badminton",
    campus: "zijingang",
    note: "羽毛球赛事、培训、师生赛",
  },
  {
    name: "浙大足协",
    accountId: "gh_zju_football",
    campus: "zijingang",
    note: "足球联赛、三好杯足球赛、校内约球",
  },
  {
    name: "浙大篮联",
    accountId: "gh_zju_basketball",
    campus: "zijingang",
    note: "篮球联赛、三好杯篮球赛",
  },
  {
    name: "浙大网协",
    accountId: "gh_zju_tennis",
    campus: "zijingang",
    note: "网球赛事、培训",
  },
  {
    name: "浙大乒协",
    accountId: "gh_zju_tabletennis",
    campus: "all",
    note: "乒乓球积分赛、三好杯乒乓球",
  },
  {
    name: "浙江大学CC98论坛",
    accountId: "gh_zju_cc98",
    campus: "all",
    note: "校园综合信息，体育板块偶有赛事通知",
  },
];

export function getSourceByName(name: string): WechatSource | undefined {
  return TARGET_SOURCES.find((s) => s.name === name);
}
