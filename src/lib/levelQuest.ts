/**
 * 🎯 홈 「다음 레벨까지」 — 레벨 퀘스트 (2026-11-18 대표님
 * 「마이복서 153 현재 목표와 레벨 또 다음 레벨까지 몇번 출석하면되는지 직관적으로 알수있도록 홈화면에 표시해줘 …
 *  1일차 수업 2일차 수업 3일차 수업 반복은 천재를 만든다는 말로 응원해주며 레벨업 하는재미를 느낄수있도록」)
 *
 * 11/16 「다음 레벨까지」(몇 번 더 오면 되는지 · 이번 레벨 미션) 카드 위에 얹는다 — 화면 없는 계산만 (시험 levelQuest.test.ts).
 * 판정 숫자(출석 · 진행도 · 심사)는 모두 서버(get_level_cycle_progress · level_status) — 여기서는 모양과 말만 정한다.
 *
 *   · 수업 도장 — 이번 레벨에 필요한 출석(화이트 3 · 블루 5 · 레드 8 · 블랙 20 = 서버 level_visit_requirement)을 도장 칸으로.
 *     칸 이름은 153 수업 일차 — 화이트 레벨 1 = 1~3일차, 레벨 2 = 4~6일차 … (153 수업 매뉴얼 level_lesson_days.day_no ·
 *     훈련 탭 「오늘 수업 · n일차」와 같은 셈). 블루는 31일차부터 한 레벨 5칸, 레드는 81일차부터 8칸, 블랙은 161일차부터 20칸.
 *     채운 칸 = 진행도 내림값(progressFloor — 판정과 같은 숫자) · 다음 칸은 운동 종료 보너스(1회 최대 1.25)로 미리 찬 만큼.
 *   · 응원 — 「반복은 천재를 만든다」 + 그날 상태 한 줄. 날마다 다른 말(같은 날은 같은 말) · 못한 것 · 빠진 날은 말하지 않는다
 *     (회원 감정 설계 기준 ③ ⑤).
 *   · 보상 — 레벨업하면 받는 것. XP · 챔피언 머니는 서버 함수 값(auto_advance_from_attendance · approve_level_review),
 *     마일리지는 운영 설정(app_settings.mileage_rules — 관리자가 바꾸면 바로 따라간다). PT 회원 XP 2배는 화면에 쓰지 않는다
 *     (2026-09-29 대표님 — 일반 회원님이 차별로 느낄 수 있다).
 *
 * v2 (같은 날 15:22 대표님 「심리적으로 채우고싶은 느낌이 나고 게임처럼 레벨업 하고싶은 욕구가 강해질수있는 디자인으로」) —
 * 게임 설계에서 오래 검증된 동기 장치를 153 감정 설계(못한 것은 보이지 않는다) 안에서만 쓴다:
 *   · 이미 쌓은 것 보여 주기(부여된 진전 효과) — 리그 막대 9칸 + 트로피: 지나온 레벨 · 지금 레벨은 진행만큼 (leagueBars)
 *   · 목표가 가까울수록 더 크게(목표 기울기 효과) — 남은 출석 1번이면 「1번만 더 오면 레벨 5!」 · 마지막 칸 = 「레벨업 도장」 ·
 *     선물이 들썩인다 (questHero · questNear · lastStampTag)
 *   · 빈칸을 채우고 싶은 마음(미완성 효과) — 빈 홈은 움푹, 채운 칸은 반짝 · 운동 보너스로 다음 칸이 조금 찬 것도 보인다
 *   · 바로 받는 보상 — 오늘의 퀘스트: 오늘 오면 도장 +1 · 챔피언 머니 +100 · 마일리지(운영 설정), 오면 「받았어요」 (dailyQuest)
 *   · 다음이 궁금하게 — 보상 상자에 다음 레벨에서 배울 기술 한 줄 (questSkill — 잠금이 아니라 '배워요')
 *   · 레벨업한 날 — 「레벨 5 달성 보상 · 받았어요」 (questReward received)
 * 실제로 받는 값만 쓴다 — 하루 출석 챔피언 머니 100 = 서버 attendance_base_xp_trg(한국 날짜 하루 한 번) · 출석 마일리지 =
 * mileage_on_attendance(운영 설정 attendance · 하루 한 번). 출석 XP 는 기본 분 · PT 여부로 달라져 쓰지 않는다.
 */
import { RANK_LABELS } from "@/data/sharedConstants";
import { toGlobalLevel } from "@/lib/rankLabels";

export const LEAGUE_ORDER = ["white", "blue", "red", "black"] as const;
export type QuestLeague = (typeof LEAGUE_ORDER)[number];

/** 한 레벨에 필요한 출석 — 서버 level_visit_requirement 와 같은 값 (바뀌면 같이) */
export const LEAGUE_VISITS: Readonly<Record<QuestLeague, number>> = { white: 3, blue: 5, red: 8, black: 20 };

/** 도장 칸 상한 — 블랙(20칸)까지 */
export const MAX_STAMPS = 20;

/** 「반복은 천재를 만든다」 — 대표님 응원 문구 (늘 같은 자리에) */
export const CHEER_HEADLINE = "반복은 천재를 만든다";

const toLeague = (v: string | null | undefined): QuestLeague => {
  const k = (v ?? "").toLowerCase();
  return (LEAGUE_ORDER as readonly string[]).includes(k) ? (k as QuestLeague) : "white";
};

const clampLevel = (n: number) => Math.min(10, Math.max(1, Math.round(Number(n) || 1)));

/** "레벨 5" — 누적 레벨 (블루 3 = 레벨 13) */
export const levelLabel = (league: string, level: number): string => `레벨 ${toGlobalLevel(toLeague(league), clampLevel(level))}`;

/** 다음 리그 이름 — 블랙 다음은 마스터 로드 */
export function nextLeagueLabel(league: string): string {
  const next = LEAGUE_ORDER[LEAGUE_ORDER.indexOf(toLeague(league)) + 1];
  return next ? `${RANK_LABELS[next]} 리그` : "마스터 로드";
}

/**
 * 이 레벨 첫 수업 바로 앞의 일차 — 화이트 레벨 2 → 3 (4 · 5 · 6일차) · 블루 레벨 1 → 30 (31일차부터).
 * 153 수업 매뉴얼(level_lesson_days.day_no)과 같은 셈 — 리그마다 한 레벨에 필요한 출석만큼 이어서 센다.
 */
export function levelDayOffset(league: string, level: number): number {
  const lg = toLeague(league);
  let off = 0;
  for (const l of LEAGUE_ORDER) {
    if (l === lg) return off + (clampLevel(level) - 1) * LEAGUE_VISITS[l];
    off += 10 * LEAGUE_VISITS[l];
  }
  return off;
}

/**
 * 이 레벨은 수업 도장(출석)으로 가나 — 레벨 1~9는 모두, 레벨 10은 레드 · 블랙만(출석을 채우면 심사).
 * 화이트 · 블루 레벨 10은 도착하자마자 타이틀매치(심사)라 도장 대신 리그 길을 그린다.
 */
export function usesStamps(league: string, level: number): boolean {
  if (clampLevel(level) < 10) return true;
  const lg = toLeague(league);
  return lg === "red" || lg === "black";
}

export type StampState = "done" | "today" | "next" | "todo";

export interface QuestStamp {
  /** 153 수업 일차 (1일차 = 첫 수업) */
  day: number;
  state: StampState;
  /** 다음 칸 — 운동 종료 보너스로 미리 찬 몫 0 ~ 0.99 (다른 칸은 0) */
  partial: number;
}

export interface QuestStampInput {
  league: string;
  /** 리그 안 레벨 1~10 */
  level: number;
  /** 이번 레벨 필요 출석 (서버 reqSessions) */
  req: number;
  /** 진행도 (예: 2.25 — 서버 progress). 없으면 내림값만 */
  progress?: number | null;
  /** 진행도 내림값 = 판정 숫자 (서버 progressFloor) */
  progressFloor: number;
  /** 오늘 체육관에 왔나 (get_my_workout_today) */
  attendedToday: boolean;
  /** 오늘 레벨이 올랐나 — 코치 승인이면 오늘 출석은 지난 레벨 몫(칸 0) · 출석 자동 승급(2026-11-27~)이면 오늘 출석이 새 레벨 첫 칸일 수 있다 */
  leveledUpToday: boolean;
}

/** 이번 레벨 수업 도장 칸 — 채운 칸(오늘 칸) · 다음 칸 · 남은 칸 */
export function questStamps(i: QuestStampInput): QuestStamp[] {
  const n = Math.min(MAX_STAMPS, Math.max(1, Math.round(Number(i.req) || 1)));
  const floor = Math.max(0, Math.floor(Number(i.progressFloor) || 0));
  const filled = Math.min(n, floor);
  const prog = Number(i.progress);
  const frac = Number.isFinite(prog) ? Math.min(0.99, Math.max(0, prog - floor)) : 0;
  // 오늘 왔으면 마지막으로 채운 칸이 오늘 칸 — 오늘 레벨이 올랐어도 칸이 채워져 있으면 그건 오늘 출석(승급시킨 출석을 새 레벨로 넘김 ·
  // 2026-11-27). 코치 승인처럼 오늘 출석이 지난 레벨 몫이면 칸이 0이라 오늘 칸이 없다.
  const todayIdx = i.attendedToday && filled > 0 ? filled - 1 : -1;
  const off = levelDayOffset(i.league, i.level);
  return Array.from({ length: n }, (_, k) => ({
    day: off + k + 1,
    state: k < filled ? (k === todayIdx ? "today" : "done") : k === filled ? "next" : "todo",
    partial: k === filled ? Math.round(frac * 100) / 100 : 0,
  }));
}

/** 한국 날짜 'YYYY-MM-DD' — 못 읽으면 빈 글 */
export function kstDay(v: string | number | Date | null | undefined): string {
  if (v == null || v === "") return "";
  const t = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v);
  if (!Number.isFinite(t)) return "";
  return new Date(t + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 오늘 레벨이 올랐나 — 이번 레벨 시작(level_started_at = since)이 오늘(한국)이고, 오늘 체육관에 왔고, 이번 레벨 출석이 오늘 것뿐(0 또는 1).
 * 코치 승인 · 타이틀매치 통과는 그때부터라 오늘 출석은 지난 레벨 몫(0). 출석 자동 승급은 (2026-11-27~) 승급시킨 오늘 출석이
 * 요건을 채우는 데 필요 없었으면 새 레벨 첫 출석(1 — DB 20261127002959_levelup_carry_visit.sql) · 필요했으면 지난 레벨 몫(0).
 * 처음 시작한 레벨(누적 레벨 1)은 레벨업이 아니다.
 */
export function leveledUpToday(i: {
  since?: string | null;
  today: string;
  globalLevel: number;
  sessions: number;
  attendedToday: boolean;
}): boolean {
  if (!i.attendedToday || !i.since || i.globalLevel <= 1 || Number(i.sessions) > 1) return false;
  return kstDay(i.since) === i.today;
}

export type QuestTone = "reward" | "pending" | "plain";

export interface QuestHero {
  /** 주인공 한 줄 전체 (화면 읽기 · 시험) */
  text: string;
  /** 민트로 강조할 앞 숫자 — "2번" (없으면 null) */
  lead: string | null;
  /** lead 뒤의 글 — " 더 오면 레벨 5" (lead 가 없으면 text 와 같다) */
  rest: string;
  tone: QuestTone;
}

export interface QuestHeroInput {
  /** 이번 목표 — "레벨 5" · "블루 리그" · "마스터 로드" */
  nextLabel: string;
  /** 오늘 올라온 곳 — "레벨 5" · 리그 첫 레벨이면 "블루 리그" */
  reachedLabel: string;
  visitsLeft: number;
  daysLeft: number;
  meets: boolean;
  /** 출석을 채우면 심사(레드 · 블랙) — 자동 승급이 아니다 */
  needsReview: boolean;
  pending: boolean;
  revision: boolean;
  leveledUpToday: boolean;
}

/**
 * 주인공 한 줄 — 「2번 더 오면 레벨 5」 · 「1번만 더 오면 레벨 5!」 · 「다음 출석 때 레벨 5!」 · 「레벨 5 달성!」 … (숫자는 서버 값 그대로).
 * 남은 출석이 1번이면 「1번만 … !」 — 목표가 눈앞일 때 가장 힘이 난다(목표 기울기 효과, v2).
 */
export function questHero(i: QuestHeroInput): QuestHero {
  const plain = (text: string, tone: QuestTone = "plain"): QuestHero => ({ text, lead: null, rest: text, tone });
  if (i.leveledUpToday) {
    return plain(i.reachedLabel.endsWith("리그") ? `${i.reachedLabel} 입성!` : `${i.reachedLabel} 달성!`, "reward");
  }
  if (i.pending) return plain("승인을 기다려요", "pending");
  if (i.revision) return plain("보완 요청이 왔어요", "pending");
  if (i.meets) return plain(i.needsReview ? "승급 심사가 열렸어요" : `다음 출석 때 ${i.nextLabel}!`, "reward");
  if (i.visitsLeft > 0) {
    const near = i.visitsLeft === 1;
    const lead = near ? "1번만" : `${i.visitsLeft}번`;
    const rest = (i.needsReview ? " 더 오면 승급 심사" : ` 더 오면 ${i.nextLabel}`) + (near ? "!" : "");
    return { text: lead + rest, lead, rest, tone: "plain" };
  }
  if (i.daysLeft > 0) {
    const lead = `${i.daysLeft}일`;
    const rest = " 더 지나면 승급 심사";
    return { text: lead + rest, lead, rest, tone: "plain" };
  }
  return plain("거의 다 왔어요");
}

export type CheerMood = "first" | "fresh" | "leveledUp" | "today" | "between" | "full" | "review" | "revision" | "days";

/**
 * 응원 한 줄 — 날마다 돌아가며 (같은 날은 같은 말). 한 줄에 들어가게 짧게 · 숫자 없이(도장 칸이 일차를 말한다) ·
 * 못한 것 · 빠진 날은 말하지 않는다. 바꾸면 시험(levelQuest.test.ts)이 길이 · 낱말을 본다.
 */
export const CHEER_LINES: Readonly<Record<"first" | "fresh" | "leveledUp" | "today" | "between" | "full", readonly string[]>> = {
  first: ["첫 수업이 가장 멋진 시작이에요", "첫 도장을 찍으러 와요"],
  fresh: ["새 레벨 첫 도장을 찍으러 와요", "새 레벨, 새 동작이 기다려요"],
  leveledUp: ["오늘 수업으로 레벨업했어요", "반복이 만든 레벨업이에요"],
  today: ["오늘 도장 꾹! 몸이 기억해요", "오늘도 반복 하나 해냈어요", "수업 완료! 더 단단해졌어요"],
  between: ["다음 도장을 찍으러 와요", "한 번 더 오면 몸이 기억해요", "오늘의 한 번이 실력이 돼요"],
  full: ["도장 완성! 다음 출석에 레벨업"],
};

export interface CheerMoodInput {
  globalLevel: number;
  /** 채운 도장 칸 수 */
  filled: number;
  attendedToday: boolean;
  leveledUpToday: boolean;
  meets: boolean;
  needsReview: boolean;
  pending: boolean;
  revision: boolean;
  visitsLeft: number;
  daysLeft: number;
}

/** 지금 상태 → 응원 종류 */
export function cheerMood(i: CheerMoodInput): CheerMood {
  if (i.leveledUpToday) return "leveledUp";
  if (i.revision) return "revision";
  if (i.pending) return "review";
  if (i.meets) return i.needsReview ? "review" : "full";
  if (i.visitsLeft <= 0 && i.daysLeft > 0) return "days";
  if (i.filled > 0) return i.attendedToday ? "today" : "between";
  return i.globalLevel <= 1 ? "first" : "fresh";
}

/** 'YYYY-MM-DD' → 날 번호 (못 읽으면 0) — 날마다 다른 응원 고르기 */
export function dayNumber(day: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day ?? "");
  if (!m) return 0;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? Math.floor(t / 86_400_000) : 0;
}

/** 응원 한 줄 (CHEER_HEADLINE 아래) */
export function questCheerLine(
  mood: CheerMood,
  opts: { today: string; reviewer?: string | null; minDays?: number | null },
): string {
  switch (mood) {
    case "review":
      return `${opts.reviewer || "코치님"}이 보고 승급해요`;
    case "revision":
      // 훈련 탭 '레벨업까지'와 같은 말
      return "더 연습하고 출석하면 다시 심사에 올라가요";
    case "days":
      return `레벨마다 최소 ${Math.max(1, Math.round(Number(opts.minDays) || 45))}일이에요`;
    default: {
      const list = CHEER_LINES[mood];
      return list[Math.abs(dayNumber(opts.today)) % list.length];
    }
  }
}

/** 레벨업 보상 — 서버 함수 값 (바뀌면 같이: auto_advance_from_attendance · approve_level_review) */
export const LEVELUP_XP = 50;
export const LEVELUP_MONEY_AUTO = 500;
export const LEVELUP_MONEY_APPROVAL = 1000;
/** 체육관 출석 챔피언 머니 — 서버 attendance_base_xp_trg (한국 날짜 하루 한 번 · 바뀌면 같이) */
export const ATTEND_MONEY = 100;

export type QuestRewardKey = "xp" | "money" | "mileage" | "league";

export interface QuestRewardInput {
  /** 레벨 10(타이틀매치) — 통과하면 다음 리그 */
  boss: boolean;
  /** 코치 승인으로 오르는 레벨(레드 · 블랙) — 챔피언 머니가 다르다 */
  approval: boolean;
  /** 레벨 10이면 받는 곳 — "블루 리그" · "마스터 로드" */
  nextLeague: string;
  /** 운영 마일리지 설정 (못 읽었으면 null — 마일리지 칸 없이) */
  mileage: { enabled: boolean; level_up: number; title_match: number } | null | undefined;
  /** 보상 이름 앞 — "레벨 5" → 「레벨 5 달성 보상」 (레벨 1~9 · 레벨업한 날은 오늘 오른 레벨) */
  goal?: string | null;
  /** 레벨업한 날 — 오늘 받은 보상 (「… · 받았어요」) */
  received?: boolean;
}

export interface QuestRewardItem {
  /** 아이콘 고르기 — XP 번개 · 챔피언 머니 지폐 · 마일리지 동전 · 승급 트로피 */
  key: QuestRewardKey;
  /** 무엇 — "XP" · "챔피언 머니" · "마일리지" · "승급" */
  name: string;
  /** 얼마 — "+50" · "블루 리그" */
  value: string;
}

export interface QuestReward {
  /** 머리 — 「레벨 5 달성 보상」 · 「타이틀매치 통과 보상」 */
  label: string;
  items: QuestRewardItem[];
  /** 오늘 받은 보상인가 (레벨업한 날) */
  received: boolean;
}

const won = (n: number) => Math.trunc(n).toLocaleString("ko-KR");

/**
 * 레벨업 보상 — 레벨 1~9 = XP · 챔피언 머니 · 마일리지 / 레벨 10 = 다음 리그 · 타이틀매치 마일리지.
 * 레벨업한 날은 오늘 받은 것 — 출석 · 코치 승인으로 오른 레벨의 보상(레벨 1~9와 같은 셈, received).
 */
export function questReward(i: QuestRewardInput): QuestReward {
  const m = i.mileage && i.mileage.enabled ? i.mileage : null;
  const received = !!i.received;
  if (i.boss && !received) {
    const items: QuestRewardItem[] = [{ key: "league", name: "승급", value: i.nextLeague }];
    if (m && m.title_match > 0) items.push({ key: "mileage", name: "마일리지", value: `+${won(m.title_match)}` });
    return { label: "타이틀매치 통과 보상", items, received: false };
  }
  const items: QuestRewardItem[] = [
    { key: "xp", name: "XP", value: `+${LEVELUP_XP}` },
    { key: "money", name: "챔피언 머니", value: `+${won(i.approval ? LEVELUP_MONEY_APPROVAL : LEVELUP_MONEY_AUTO)}` },
  ];
  if (m && m.level_up > 0) items.push({ key: "mileage", name: "마일리지", value: `+${won(m.level_up)}` });
  return { label: i.goal ? `${i.goal} 달성 보상` : "레벨업 보상", items, received };
}

/** 레벨 10 리그 길 — 이 리그 레벨 1~9는 지나온 칸, 레벨 10은 타이틀매치 칸 (누적 레벨) */
export function leagueRoad(league: string): { level: number; state: "done" | "goal" }[] {
  const base = toGlobalLevel(toLeague(league), 1) - 1;
  return Array.from({ length: 10 }, (_, k) => ({ level: base + k + 1, state: k < 9 ? "done" : "goal" }));
}

// ─── v2 — 채우고 싶게 · 게임처럼 (2026-11-18 15:22) ───

/** 이번 레벨 진행 0 ~ 1 — 진행도 ÷ 필요 출석 (요건을 채웠으면 1 · 이상한 값은 0) */
export function levelFill(i: { progress?: number | null; progressFloor: number; req: number; meets: boolean }): number {
  if (i.meets) return 1;
  const req = Math.max(1, Math.round(Number(i.req) || 1));
  const p = Number.isFinite(Number(i.progress)) && i.progress != null ? Number(i.progress) : Number(i.progressFloor) || 0;
  return Math.min(1, Math.max(0, p / req));
}

/**
 * 리그 막대 9칸 (레벨 1~9 — 레벨 10은 트로피) — 지나온 레벨 1 · 지금 레벨은 이번 레벨 진행만큼 · 앞 레벨 0.
 * 이미 쌓은 것을 먼저 보여 준다(부여된 진전 효과) — 화이트 레벨 4 = 세 칸 반쯤 찬 리그.
 */
export function leagueBars(level: number, fill: number): number[] {
  const lv = clampLevel(level);
  const f = Math.min(1, Math.max(0, Number(fill) || 0));
  return Array.from({ length: 9 }, (_, k) => (k + 1 < lv ? 1 : k + 1 === lv ? Math.round(f * 100) / 100 : 0));
}

/** 목표가 눈앞 — 남은 출석 1번 (도장을 다 모았거나 · 심사 대기 · 보완 요청이면 아님) */
export function questNear(i: { visitsLeft: number; meets: boolean; pending: boolean; revision: boolean }): boolean {
  return i.visitsLeft === 1 && !i.meets && !i.pending && !i.revision;
}

/** 마지막 도장 칸 이름 — 출석으로 오르는 리그는 「레벨업 도장」, 심사 리그(레드 · 블랙 · 레벨 10)는 「마지막 도장」 */
export function lastStampTag(needsReview: boolean): string {
  return needsReview ? "마지막 도장" : "레벨업 도장";
}

export type DailyQuestKey = "stamp" | "levelup" | "money" | "mileage";

export interface DailyQuestItem {
  key: DailyQuestKey;
  /** 무엇 — "도장" · "레벨업" · "챔피언 머니" · "마일리지" (읽기 · 시험) */
  name: string;
  /** 얼마 — "+1" · "레벨업!" · "+100" · "+300" */
  value: string;
}

export interface DailyQuest {
  /** 오늘 체육관에 왔다 — 「받았어요」 */
  done: boolean;
  title: string;
  /** 제목 옆 한마디 — 「오면 받아요」 · 「받았어요」 */
  note: string;
  items: DailyQuestItem[];
}

export interface DailyQuestInput {
  attendedToday: boolean;
  leveledUpToday: boolean;
  /** 이번 레벨이 도장으로 가나 (usesStamps) */
  stamps: boolean;
  /** 오늘 칸이 찍혔나 (오늘 왔고 이번 레벨 칸이 하나 늘었다) */
  stampedToday: boolean;
  visitsLeft: number;
  meets: boolean;
  needsReview: boolean;
  pending: boolean;
  /** 운영 마일리지 설정 (못 읽었으면 null — 마일리지 칸 없이) */
  mileage: { enabled: boolean; attendance: number } | null | undefined;
}

/**
 * 오늘의 퀘스트 — 체육관에 오면 바로 받는 것 (게임의 하루 퀘스트처럼 · 실제로 받는 값만).
 *   · 도장 +1 — 이번 레벨이 도장으로 가고 아직 칸이 남았을 때 (심사 대기 · 다 모은 뒤 · 레벨 10 타이틀매치는 없음)
 *   · 레벨업! — 출석으로 오르는 리그에서 도장을 다 모았으면 다음 출석이 레벨업
 *   · 챔피언 머니 +100 · 마일리지 — 출석하면 하루 한 번 (서버 트리거)
 * 오늘 왔으면 같은 칸을 「받았어요」로 — 레벨업한 날은 레벨업, 오늘 칸이 찍힌 날은 도장 +1.
 */
export function dailyQuest(i: DailyQuestInput): DailyQuest {
  const items: DailyQuestItem[] = [];
  if (i.attendedToday) {
    if (i.leveledUpToday) items.push({ key: "levelup", name: "레벨업", value: "레벨업!" });
    else if (i.stampedToday) items.push({ key: "stamp", name: "도장", value: "+1" });
  } else if (i.stamps && !i.pending) {
    if (i.meets && !i.needsReview) items.push({ key: "levelup", name: "레벨업", value: "레벨업!" });
    else if (!i.meets && i.visitsLeft > 0) items.push({ key: "stamp", name: "도장", value: "+1" });
  }
  items.push({ key: "money", name: "챔피언 머니", value: `+${won(ATTEND_MONEY)}` });
  const m = i.mileage && i.mileage.enabled && i.mileage.attendance > 0 ? i.mileage : null;
  if (m) items.push({ key: "mileage", name: "마일리지", value: `+${won(m.attendance)}` });
  return i.attendedToday
    ? { done: true, title: "오늘의 퀘스트 완료!", note: "받았어요", items }
    : { done: false, title: "오늘의 퀘스트", note: "오면 받아요", items };
}

export interface QuestSkill {
  /** 「새 기술」 · 「다음 단계」 · 「오늘부터 배워요」 · 「블루 리그 첫 기술」 */
  label: string;
  /** 레벨 이름 — "안정적인 원투" · "타이틀매치 도전" */
  value: string;
}

/**
 * 보상 상자 맨 아래 — 다음에 배울 것 한 줄 (궁금하게 · 잠금이 아니라 '배워요' — 위 레벨 영상은 잠그지 않는다).
 * 레벨 이름은 레벨 데이터(allLevelsData)를 이미 읽는 화면이 넘긴다 (title). 이름을 모르면 줄 없이.
 */
export function questSkill(i: {
  league: string;
  level: number;
  leveledUpToday: boolean;
  title: ((league: string, level: number) => string | null | undefined) | null | undefined;
}): QuestSkill | null {
  const lg = toLeague(i.league);
  const lv = clampLevel(i.level);
  const name = (league: string, level: number) => {
    const t = i.title?.(league, level);
    return typeof t === "string" && t.trim() ? t.trim() : null;
  };
  const titleMatch: QuestSkill = { label: "다음 단계", value: "타이틀매치 도전" };
  if (i.leveledUpToday) {
    if (lv === 10) return titleMatch;
    const v = name(lg, lv);
    return v ? { label: "오늘부터 배워요", value: v } : null;
  }
  if (lv === 10) {
    const next = LEAGUE_ORDER[LEAGUE_ORDER.indexOf(lg) + 1];
    if (!next) return null;
    const v = name(next, 1);
    return v ? { label: `${RANK_LABELS[next]} 리그 첫 ${next === "black" ? "과제" : "기술"}`, value: v } : null;
  }
  if (lv === 9) return titleMatch;
  const v = name(lg, lv + 1);
  return v ? { label: lg === "black" ? "새 과제" : "새 기술", value: v } : null;
}
