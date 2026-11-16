/**
 * 🌱 오늘의 1분 성장 2단계 — 체육관으로 (2026-11-17 대표님 「다음진행」 · 선릉역점부터)
 *   보고서 https://claude.ai/artifact/5tVEQmxgmzABfNwZaHibtq 「2단계. 체육관으로」
 *   화면 없는 계산 · 글 한 곳:
 *     · 내 읽은 날 · 누적 도장 — 읽은 날 10 · 30 · 100 · 365번째에 축하 편지(보상 없음 · 연속이 아니라 누적)
 *     · 운동 달력 「오늘의 체크」의 '1분 성장' 칸(check_from 날부터 — lib/calendarChecks dayChecks)
 *     · 코치 「오늘의 한마디」(153운영본부 일정 탭 맨 위)
 *     · TV 「오늘의 1분」(라이브보드 2번 화면 오른쪽 칸)
 *   서버: supabase/migrations/20261117013509_growth_stage2.sql (get_my_growth · growth_coach_state · growth_coach_say)
 *   감정 설계: 읽은 날은 누적으로만 센다 — 빠진 날 · 끊긴 기록은 어디에도 없다.
 */
import { cornerOf, type GrowthLesson } from "@/data/growth/types";
import type { LetterContent } from "@/lib/welcomeLetters";

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null);
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const ymd = (v: unknown): string | null => (typeof v === "string" && YMD.test(v) ? v : null);
const count = (v: unknown): number => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0;
};
const comma = (v: number) => v.toLocaleString("ko-KR");

// ───────────────────────── 내 읽은 날 · 누적 도장 ─────────────────────────
/** 누적 도장 — 읽은 날 n번째 (서버 설정 growth_pilot.stamps 와 같은 기본값) */
export const GROWTH_STAMPS: readonly number[] = [10, 30, 100, 365];

export interface MyGrowth {
  /** 켠 지점 회원인가 (아니면 화면에 아무것도 없다) */
  on: boolean;
  /** 지금까지 읽은 날 */
  days: number;
  /** 다음 도장 (없으면 null) */
  next: number | null;
  /** 아직 안 본 도장 — 가장 큰 것 (없으면 null) */
  unseen: number | null;
  /** 도장 숫자들 (서버 설정 — 못 받으면 기본값) */
  stamps: readonly number[];
  /** 운동 달력 「오늘의 체크」에 1분 성장이 드는 첫날 (null = 안 듦) */
  checkFrom: string | null;
  /** 물어본 범위의 읽은 날 */
  read: ReadonlySet<string>;
}

export const MY_GROWTH_OFF: MyGrowth = { on: false, days: 0, next: null, unseen: null, stamps: GROWTH_STAMPS, checkFrom: null, read: new Set() };

/** 서버 값을 믿지 않고 다듬는다 */
export function normalizeMyGrowth(raw: unknown): MyGrowth {
  const r = obj(raw);
  if (!r || r.on !== true) return MY_GROWTH_OFF;
  const read = new Set<string>();
  for (const d of Array.isArray(r.read) ? r.read : []) {
    const day = ymd(d);
    if (day) read.add(day);
  }
  return {
    on: true,
    days: count(r.days),
    next: count(r.next) || null,
    unseen: count(r.unseen) || null,
    stamps: Array.isArray(r.stamps)
      ? [...new Set(r.stamps.map(count).filter((n) => n > 0))].sort((a, b) => a - b)
      : GROWTH_STAMPS,
    checkFrom: ymd(r.check_from),
    read,
  };
}

/** 운동 달력에 붙이는 조각 — 그날의 체크에 '1분 성장'이 드는 날과 읽은 날 (안 드는 계정이면 null) */
export interface GrowthCheck {
  from: string;
  days: ReadonlySet<string>;
}
export const growthCheckOf = (g: MyGrowth | null | undefined): GrowthCheck | null =>
  g?.on && g.checkFrom ? { from: g.checkFrom, days: g.read } : null;

/** 서랍 아래 한 줄 — 쌓인 날과 다음 한 걸음만 (아직 0일이면 아무 말도 안 한다) */
export function growthDaysLine(g: MyGrowth | null | undefined): string | null {
  if (!g?.on || g.days < 1) return null;
  const base = `지금까지 ${comma(g.days)}일 읽었어요`;
  return g.next ? `${base} · ${comma(g.next)}일째에 축하 편지가 와요` : base;
}

/** 도장을 받은 순간의 한 줄 (서랍을 연 채로 — 편지는 다음에 앱을 열 때 온다) */
export const growthStampToast = (n: number): string => `읽은 날 ${comma(count(n))}일째예요. 축하해요!`;

const who = (name: string) => (name || "").trim() || "복서";

/** 다음 도장 (없으면 null) */
export const nextStampAfter = (n: number, stamps: readonly number[] = GROWTH_STAMPS): number | null =>
  [...stamps].sort((a, b) => a - b).find((s) => s > n) ?? null;

/** 누적 도장 축하 편지 — 선물 없이 마음만 */
export function growthLetter(name: string, n: number, stamps: readonly number[] = GROWTH_STAMPS): LetterContent {
  const w = who(name);
  const m = Math.max(1, count(n));
  const next = nextStampAfter(m, stamps);
  const again = next ? `\n\n다음 ${comma(next)}일째에 또 편지할게요.` : "";
  const body =
    m >= 365
      ? `${comma(m)}번의 1분.
긴 시간을 153과 함께 읽었어요.

첫 글을 열던 날과 지금의 ${w}님은 달라요.
아는 것이 늘었고, 몸이 그것을 해내요.

고마워요.
하루하루 조금씩,
153과 함께 자라 줘서요.`
      : m >= 100
        ? `${comma(m)}번의 1분.
${comma(m)}번이나 '오늘도 한 걸음'을 골랐어요.

복싱은 재능보다
다시 오는 힘이 만드는 운동이에요.
읽는 것도 같아요.

${w}님은 꾸준한 사람이에요.`
        : m >= 30
          ? `1분이 ${comma(m)}번 모였어요.
이만큼이면 이제 ${w}님의 버릇이에요.

글에서 본 것을 체육관에서 해 보고,
체육관에서 한 것을 글에서 다시 만나요.
그 사이에 복싱이 조금씩 내 것이 돼요.`
          : `하루 1분이 ${comma(m)}번 쌓였어요.

바쁜 하루 사이에 잠깐 멈춰서
한 편을 읽은 날이 ${comma(m)}번이에요.

읽은 만큼 수업이 다르게 보여요.
잽 하나, 스텝 하나에
'왜'가 생기기 시작했을 거예요.`;
  return {
    eyebrow: `${comma(m)} Days of 1 Minute`,
    title: `1분 성장 ${comma(m)}일을 채운\n${w}님께`,
    body: `${body}${again}`,
    sign: "— 153 일동",
    cta: "다음 1분도 함께 🥊",
  };
}

/** 주소의 ?growth= — '1' = 오늘 글 · 날짜 = 그날 글(지난 7일 안이면) · 그 밖은 null */
export function growthFocusOf(param: string | null | undefined, today: string): { day: string } | null {
  if (!param) return null;
  const v = param.trim();
  if (v === "1" || v === "today") return { day: today };
  return YMD.test(v) && v <= today ? { day: v } : null;
}

// ───────────────────────── 코치 「오늘의 한마디」 ─────────────────────────
export const COACH_LINE_MAX = 40;

export interface CoachLine {
  /** 수업에서 말할 한 문장 */
  line: string;
  /** 요일 코너 (날마다 글) — 예전 글이면 "" */
  corner: string;
  /** 그날 글 제목 */
  title: string;
  /** O/X 글인가 — 답은 앱에서 */
  quiz: boolean;
}

/** 그날 글의 코치 한마디 — coach 가 없으면 '오늘 하나' 제목으로 */
export function coachLineOf(lesson: GrowthLesson | null | undefined): CoachLine | null {
  if (!lesson) return null;
  const line = (lesson.coach ?? "").trim() || (lesson.directions[0] ? `오늘 하나, ${lesson.directions[0].title}` : "");
  if (!line) return null;
  return { line, corner: lesson.days === 1 ? lesson.theme : "", title: lesson.title, quiz: !!lesson.quiz };
}

export interface GrowthCoachState {
  on: boolean;
  /** 오늘 내가 전했다고 눌렀나 */
  mine: boolean;
  /** 오늘 전했다고 누른 코치진 수 */
  count: number;
}
export const COACH_STATE_OFF: GrowthCoachState = { on: false, mine: false, count: 0 };

export function normalizeCoachState(raw: unknown): GrowthCoachState {
  const r = obj(raw);
  if (!r || r.on !== true) return COACH_STATE_OFF;
  return { on: true, mine: r.mine === true, count: count(r.count) };
}

/** 한마디 아래 한 줄 — 누가 전했나(사람 수만) · 아직이면 쓰는 법 (단추 글 「전했어요」와 같은 말을 되풀이하지 않는다) */
export function coachSaidLine(s: GrowthCoachState): string {
  if (s.count <= 0) return "수업 시작이나 마무리에 한마디, 의무는 아니에요";
  if (s.mine && s.count === 1) return "오늘 회원님께 한마디가 닿았어요";
  return `오늘 ${comma(s.count)}명이 전했어요`;
}

// ───────────────────────── TV 「오늘의 1분」 ─────────────────────────
/** 2단계를 켠 지점 TV — 서버 설정 growth_pilot.branches 와 같은 지점 (TV 는 로그인이 없어 앱에 둔다) */
export const GROWTH_TV_BRANCHES: readonly string[] = ["153복싱짐 선릉역점"];
export const growthTvOn = (branch: string | null | undefined): boolean => !!branch && GROWTH_TV_BRANCHES.includes(branch.trim());

/** TV 오른쪽 칸을 번갈아 보여 주는 시간 (사전예약 안내 ↔ 오늘의 1분) */
export const TV_ROTATE_MS = 40_000;

export interface TvGrowth {
  /** 요일 코너 */
  corner: string;
  /** 큰 글 — O/X 날은 문제, 그 밖은 제목 */
  headline: string;
  /** O/X 날 */
  quiz: boolean;
  /** 제목 아래 한 줄 (O/X 날은 제목 — 제목은 답을 말하지 않는다) */
  sub: string;
  /** 오늘 하나 — 제목 · 한 줄 */
  actionTitle: string;
  actionBody: string;
  /** 맨 아래 안내 */
  foot: string;
}

/** TV 「오늘의 1분」 — 번들 글로만 그린다(통신이 끊겨도 나온다) */
export function tvGrowthOf(lesson: GrowthLesson | null | undefined, today: string): TvGrowth | null {
  if (!lesson) return null;
  const d = lesson.directions[0];
  return {
    corner: lesson.days === 1 ? lesson.theme : cornerOf(today),
    headline: lesson.quiz ? lesson.quiz.q : lesson.title,
    quiz: !!lesson.quiz,
    sub: lesson.quiz ? lesson.title : lesson.hook,
    actionTitle: d?.title ?? "",
    actionBody: d?.body ?? "",
    foot: lesson.quiz ? "정답은 마이복서153 앱 홈에서" : "이야기는 마이복서153 앱 홈에서",
  };
}

/** 지금 어느 쪽을 보여 줄까 — 둘 다 있으면 TV_ROTATE_MS 마다 번갈아(시계 기준이라 새로고침해도 이어진다) */
export function tvSideOf(nowMs: number, hasGoods: boolean, hasGrowth: boolean, rotateMs = TV_ROTATE_MS): "goods" | "growth" | null {
  if (hasGoods && hasGrowth) return Math.floor(nowMs / Math.max(1_000, rotateMs)) % 2 === 0 ? "growth" : "goods";
  if (hasGrowth) return "growth";
  return hasGoods ? "goods" : null;
}
