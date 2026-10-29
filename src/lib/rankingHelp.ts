/**
 * 랭킹 설명 단추 (2026-10-29 대표님 "니 추천대로 할게" — Claude Docs 「랭킹 설명 버튼 보고서」
 * https://claude.ai/artifact/8EJsSWmWQPaGEG2XaYye2e)
 *
 * 랭킹 탭 칩 5개가 무엇으로 줄을 세우는지 · 어떻게 올리는지 · 언제 내려가는지 · 언제 다시 시작하는지.
 * 숫자 규칙의 정본은 DB 다 — 줄 세우기 = get_division_ranking · get_weekly_activity_ranking · get_streak_ranking ·
 * get_monthly_risers_v2 · get_boss_conquerors, 레벨업 = get_levelup_rules, 내 순위 = get_my_ranking_positions.
 * 여기 글을 바꾸면 오삼코치 안내(src/data/osamiFaq.ts 'rk-types' · 'rk-how')도 같이 맞춘다.
 */

import type { LeagueRule } from "@/lib/journeyMath";

export type RankingTabKey = "official" | "weekly" | "streak" | "monthly" | "boss";

/** 칩 이름 — '출석'은 연속이 아니라 출석 체크한 날 수(누적)라 '출석일', '보상'은 실제로 타이틀매치 통과 수라 '타이틀매치' */
export const RANKING_TAB_LABEL: Record<RankingTabKey, string> = {
  official: "전체",
  weekly: "이번 주",
  streak: "출석일",
  monthly: "상승",
  boss: "타이틀매치",
};

export interface RankingHelpText {
  /** 기준 한 줄 */
  rule: string;
  /** '전체'만 — 순서 ① ② ③ */
  order?: string[];
  /** 올리려면 */
  up: string[];
  /** 내려가는 때 */
  down: string;
}

const XP_ACTIONS = [
  "체육관 출석 +5 XP (그날 첫 출석)",
  "앱 출석 체크 +10 XP (그날 처음 홈 열기)",
  "레벨업 · 타이틀매치 통과 +50 XP",
  "PT 수업권 기간에는 받는 XP 2배",
];

const RANK_KO: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

/** 은/는 — 마지막 글자 받침으로 (블랙은 · 레드는) */
function topic(word: string): string {
  const c = word.charCodeAt(word.length - 1);
  const hasBatchim = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return `${word}${hasBatchim ? "은" : "는"}`;
}

/** '전체' 올리는 법 — 레벨업 규칙(get_levelup_rules)에서 만든다. 규칙을 못 읽었으면 지금 규칙(10/29) 그대로 */
export function officialUpLines(rules?: LeagueRule[] | null): string[] {
  const list = (rules ?? []).filter((r) => RANK_KO[r.rank]);
  if (list.length === 0) {
    return [
      "체육관에 오면 레벨이 올라요 — 화이트는 3번, 블루는 5번 올 때마다 1레벨",
      "레드는 8번, 블랙은 20번을 채우면 심사를 거쳐 1레벨",
      "리그 마지막 레벨(10 · 20 · 30 · 40)에서 타이틀매치를 통과하면 다음 리그",
    ];
  }
  const auto = list.filter((r) => r.autoAdvance);
  const review = list.filter((r) => !r.autoAdvance);
  const lines: string[] = [];
  if (auto.length) {
    lines.push(
      `체육관에 오면 레벨이 올라요 — ${auto.map((r) => `${topic(RANK_KO[r.rank])} ${r.visitsPerLevel}번`).join(", ")} 올 때마다 1레벨`,
    );
  }
  if (review.length) {
    lines.push(
      `${review
        .map((r) => `${topic(RANK_KO[r.rank])} ${r.visitsPerLevel}번${r.minDaysPerLevel > 0 ? `(최소 ${r.minDaysPerLevel}일)` : ""}`)
        .join(", ")}을 채우면 심사를 거쳐 1레벨`,
    );
  }
  lines.push("리그 마지막 레벨(10 · 20 · 30 · 40)에서 타이틀매치를 통과하면 다음 리그");
  return lines;
}

export function rankingHelp(tab: RankingTabKey, rules?: LeagueRule[] | null): RankingHelpText {
  switch (tab) {
    case "official":
      return {
        rule: "레벨이 높은 순서예요.",
        order: ["레벨이 높은 사람", "레벨이 같으면 타이틀매치를 많이 통과한 사람", "그것도 같으면 XP가 많은 사람"],
        up: officialUpLines(rules),
        down: "내 레벨은 내려가지 않아요. 다른 회원이 레벨업해서 앞지르면 한 칸씩 밀려요.",
      };
    case "weekly":
      return {
        rule: "이번 주 월요일 0시부터 받은 XP 순서예요.",
        up: XP_ACTIONS,
        down: "다른 회원이 이번 주 XP를 더 받으면 밀려요.",
      };
    case "streak":
      return {
        rule: "출석 체크한 날 수예요. 하루에 한 번만 세요.",
        up: ["앱 홈을 그날 처음 열면 출석 체크가 돼서 하루 +1일 (체육관 입구 출석과는 따로 세요)"],
        down: "빠진 날이 있어도 줄지 않아요. 다른 회원이 더 많은 날 출석 체크하면 밀려요.",
      };
    case "monthly":
      return {
        rule: "이번 달 1일 0시부터 받은 XP 순서예요.",
        up: XP_ACTIONS,
        down: "다른 회원이 이번 달 XP를 더 받으면 밀려요.",
      };
    case "boss":
      return {
        rule: "타이틀매치를 통과한 횟수예요.",
        up: ["리그 마지막 레벨(10 · 20 · 30 · 40)에서 치르는 타이틀매치 심사 통과"],
        down: "다른 회원이 더 많이 통과하면 밀려요. 통과한 횟수는 줄지 않아요.",
      };
  }
}

/** 한국 시간 기준 '지금'의 날짜 조각 (기기 시간대와 상관없이) */
function kstParts(now: Date) {
  const k = new Date(now.getTime() + 9 * 3600_000);
  return { y: k.getUTCFullYear(), m: k.getUTCMonth(), d: k.getUTCDate(), dow: k.getUTCDay() };
}

/** 다시 시작까지 — '이번 주' · '상승' 만. 나머지는 null */
export function rankingResetLabel(tab: RankingTabKey, now: Date = new Date()): string | null {
  const { y, m, d, dow } = kstParts(now);
  if (tab === "weekly") {
    const days = (8 - dow) % 7 || 7; // 다음 월요일까지 남은 날 (월요일이면 7)
    return days === 1
      ? "오늘 밤 12시(월요일 0시)에 모두 0에서 다시 시작해요"
      : `월요일 0시에 모두 0에서 다시 시작해요 · ${days}일 남음`;
  }
  if (tab === "monthly") {
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const days = last - d + 1; // 다음 달 1일까지 남은 날
    return days === 1
      ? "오늘 밤 12시(다음 달 1일 0시)에 모두 0에서 다시 시작해요"
      : `다음 달 1일 0시에 모두 0에서 다시 시작해요 · ${days}일 남음`;
  }
  return null;
}

/** get_my_ranking_positions() 응답 */
export interface OfficialPoint {
  lv: number;
  bosses: number;
  xp: number;
}
export interface MyRankOfficial {
  pos: number | null;
  n: number;
  me: OfficialPoint | null;
  above: OfficialPoint | null;
}
export interface MyRankScore {
  pos: number | null;
  n: number;
  me: number;
  above: number | null;
}
export interface MyRankingPositions {
  eligible: boolean;
  official?: MyRankOfficial;
  weekly?: MyRankScore;
  monthly?: MyRankScore;
  streak?: MyRankScore;
  boss?: MyRankScore;
}

const UNIT: Record<Exclude<RankingTabKey, "official">, string> = {
  weekly: " XP",
  monthly: " XP",
  streak: "일",
  boss: "번",
};

const EMPTY: Record<Exclude<RankingTabKey, "official">, string> = {
  weekly: "출석하면 이번 주 순위에 바로 들어가요",
  monthly: "출석하면 이번 달 순위에 바로 들어가요",
  streak: "앱 홈을 열면 출석 체크가 돼요",
  boss: "타이틀매치를 통과하면 들어가요",
};

const fmt = (n: number) => n.toLocaleString("ko-KR");

/** '내 순위' 카드 — 순위 숫자와 한 줄(바로 앞 사람까지 남은 것). 순위가 없으면 pos=null + 할 일 한 줄 */
export function myRankLine(tab: RankingTabKey, data: MyRankingPositions | null | undefined): { pos: number | null; line: string } | null {
  if (!data || !data.eligible) return null;
  if (tab === "official") {
    const o = data.official;
    if (!o || o.pos == null || !o.me) return null;
    if (o.pos === 1 || !o.above) return { pos: o.pos, line: "1위예요" };
    const a = o.above;
    const me = o.me;
    if (a.lv > me.lv) return { pos: o.pos, line: `앞 사람까지 레벨 ${fmt(a.lv - me.lv)}` };
    if (a.bosses > me.bosses) return { pos: o.pos, line: `앞 사람까지 타이틀매치 ${fmt(a.bosses - me.bosses)}번` };
    if (a.xp > me.xp) return { pos: o.pos, line: `앞 사람까지 ${fmt(a.xp - me.xp)} XP` };
    return { pos: o.pos, line: "앞 사람과 점수가 같아요" };
  }
  const s = data[tab];
  if (!s) return null;
  if (s.pos == null) return { pos: null, line: EMPTY[tab] };
  if (s.pos === 1 || s.above == null) return { pos: s.pos, line: "1위예요" };
  return { pos: s.pos, line: `앞 사람까지 ${fmt(s.above - s.me)}${UNIT[tab]}` };
}
