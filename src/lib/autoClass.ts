/**
 * 🪄 내 수업 — 자동 짜기 · 오늘 수업 담기 (화면 없는 계산 · 2026-11-16 대표님 「추천대로진행」 · 보고서 「영상으로 배우기」 5단계 후보)
 *
 *   ① 자동 짜기: 시간(15 · 30 · 50분) · 목표(기본기 · 기술 · 방어 · 체력) · 내 레벨 → 내 수업 항목.
 *      정해 둔 규칙으로만 만든다(AI 비용 0) — 153 수업 흐름(워밍업 → 기본기 · 기술 → 드릴 → 체력 → 쿨다운)을 시간에 맞춰 줄인다.
 *      회원님께 보이는 카드 · 레벨 미션 영상만(화면이 골라서 넘긴다) · 영상이 있는 것 먼저 · 내 레벨까지 먼저 · 「다시 짜기」 = 다른 씨앗.
 *   ② 오늘 수업 담기: 153 수업 매뉴얼(level_lesson_days)의 그날 동작 → 내 수업 항목 —
 *      영상(레벨 미션)이 붙은 동작은 그 영상 + 라운드 그대로, 영상이 없는 동작은 이름이 같은 카드, 둘 다 없으면 건너뛴다.
 *      2026-11-16 운영 DB 에 코치님 수업 기록이 0건이라 매뉴얼로 먼저 — 수업 기록이 쌓이면 그때 같은 함수 모양으로 더한다.
 *
 *   모양은 서버 검사(_my_class_items)와 같다 — 12장 · 1~30분 · 1~12라운드 · 메모 60자. 시험 autoClass.test.ts
 */
import { MAX_ITEMS, classMinutes, clampN, cleanName, cleanNote, isClassKey, type ClassItem, type ClassUnit } from "@/lib/myClass";
import type { LessonStep } from "@/lib/lessonDays";
import type { TileKey } from "@/lib/shelfLayout";
import type { Shelf } from "@/lib/trainingCards";

/* ───────── ① 자동 짜기 ───────── */

export type AutoGoal = "basics" | "skill" | "defense" | "fitness";
export const AUTO_MINUTES = [15, 30, 50] as const;
export type AutoMinutes = (typeof AUTO_MINUTES)[number];
export const DEFAULT_AUTO_MINUTES: AutoMinutes = 30;
export const DEFAULT_AUTO_GOAL: AutoGoal = "basics";

/** 짤 수 있는 동작 하나 — 카드(c:) 또는 레벨 미션 영상(m:) */
export interface AutoCandidate {
  key: TileKey;
  name: string;
  shelf: Shelf;
  /** 이 동작의 레벨(전역 1~40) */
  level: number;
  /** 회원님이 볼 수 있는 영상이 있나 */
  video: boolean;
}

type Role = "warm" | "main" | "support" | "drill" | "finish" | "cool";
interface Slot {
  role: Role;
  u: ClassUnit;
  n: number;
}

/** 시간마다 순서 — 합계 분이 시간과 같게(라운드 = 3분 운동 + 사이 30초 · 50분은 49.5 → 50) */
const PLANS: Record<AutoMinutes, readonly Slot[]> = {
  15: [
    { role: "warm", u: "m", n: 3 },
    { role: "main", u: "m", n: 5 },
    { role: "main", u: "m", n: 4 },
    { role: "cool", u: "m", n: 3 },
  ],
  30: [
    { role: "warm", u: "m", n: 5 },
    { role: "main", u: "m", n: 5 },
    { role: "main", u: "m", n: 5 },
    { role: "main", u: "m", n: 5 },
    { role: "support", u: "m", n: 5 },
    { role: "cool", u: "m", n: 5 },
  ],
  50: [
    { role: "warm", u: "m", n: 5 },
    { role: "warm", u: "m", n: 4 },
    { role: "support", u: "m", n: 6 },
    { role: "main", u: "m", n: 6 },
    { role: "main", u: "m", n: 6 },
    { role: "main", u: "m", n: 6 },
    { role: "drill", u: "r", n: 2 },
    { role: "finish", u: "m", n: 5 },
    { role: "cool", u: "m", n: 5 },
  ],
};

export const AUTO_GOALS: readonly { id: AutoGoal; label: string; hint: string; shelves: Record<Role, readonly Shelf[]> }[] = [
  {
    id: "basics",
    label: "기본기",
    hint: "자세 · 스텝 · 잽",
    shelves: { warm: ["warmup"], main: ["basics", "step"], support: ["skill", "defense"], drill: ["drill"], finish: ["fitness"], cool: ["cooldown"] },
  },
  {
    id: "skill",
    label: "기술",
    hint: "콤비네이션 · 카운터",
    shelves: { warm: ["warmup"], main: ["skill"], support: ["basics", "step"], drill: ["drill"], finish: ["fitness"], cool: ["cooldown"] },
  },
  {
    id: "defense",
    label: "방어",
    hint: "위빙 · 더킹 · 블로킹",
    shelves: { warm: ["warmup"], main: ["defense"], support: ["skill", "basics"], drill: ["drill"], finish: ["fitness"], cool: ["cooldown"] },
  },
  {
    id: "fitness",
    label: "체력",
    hint: "줄넘기 · 인터벌 · 샌드백",
    shelves: { warm: ["warmup"], main: ["fitness", "drill"], support: ["step", "basics"], drill: ["drill"], finish: ["fitness"], cool: ["cooldown"] },
  },
];

export const goalLabel = (g: AutoGoal): string => AUTO_GOALS.find((x) => x.id === g)?.label ?? "기본기";

/** 씨앗마다 같은 값(0~1) — 「다시 짜기」가 다른 카드를 고르게 */
function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 10007) / 10007;
}

function pick(pool: readonly AutoCandidate[], shelves: readonly Shelf[], used: ReadonlySet<TileKey>, myLevel: number, seed: number): AutoCandidate | null {
  let best: AutoCandidate | null = null;
  let bestScore = -Infinity;
  for (const c of pool) {
    if (used.has(c.key) || !shelves.includes(c.shelf)) continue;
    const levelScore = c.level <= myLevel ? 40 - Math.min(30, myLevel - c.level) : 0;
    const score = (c.video ? 100 : 0) + levelScore + hash01(`${c.key}:${seed}`) * 25;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

export interface AutoClassResult {
  name: string;
  items: ClassItem[];
  /** 합계 분(서버 _my_class_minutes 와 같은 셈) */
  minutes: number;
}

/**
 * 자동 짜기 — 시간 · 목표 · 내 레벨 · 씨앗 → 내 수업. 짤 동작이 2개 안 되면 null.
 *   칸에 동작이 없는 자리는 건너뛰고 그 분을 메인 동작에 나눠 더한다(시간을 지키려고 · 30분 상한).
 */
export function autoClass(pool: readonly AutoCandidate[], opts: { minutes: AutoMinutes; goal: AutoGoal; myLevel: number; seed?: number }): AutoClassResult | null {
  const goal = AUTO_GOALS.find((g) => g.id === opts.goal) ?? AUTO_GOALS[0];
  const plan = PLANS[opts.minutes] ?? PLANS[DEFAULT_AUTO_MINUTES];
  const seed = opts.seed ?? 0;
  const myLevel = Math.max(1, Math.round(opts.myLevel || 1));
  const used = new Set<TileKey>();
  const items: ClassItem[] = [];
  const roles: Role[] = [];
  let carry = 0;
  for (const slot of plan) {
    const tries: readonly (readonly Shelf[])[] =
      slot.role === "main" || slot.role === "support" ? [goal.shelves[slot.role], goal.shelves.main, goal.shelves.support] : [goal.shelves[slot.role]];
    let got: AutoCandidate | null = null;
    for (const shelves of tries) {
      got = pick(pool, shelves, used, myLevel, seed);
      if (got) break;
    }
    if (!got) {
      carry += slot.u === "r" ? slot.n * 3 + (slot.n - 1) * 0.5 : slot.n;
      continue;
    }
    used.add(got.key);
    items.push({ k: got.key, u: slot.u, n: clampN(slot.u, slot.n), note: "" });
    roles.push(slot.role);
    if (items.length >= MAX_ITEMS) break;
  }
  if (items.length < 2) return null;
  // 건너뛴 자리의 분 → 분으로 하는 메인(없으면 분으로 하는 아무 동작)에 1분씩 돌려 가며
  let extra = Math.round(carry);
  const targets = items.map((x, i) => (x.u === "m" && roles[i] === "main" ? i : -1)).filter((i) => i >= 0);
  const pool2 = targets.length ? targets : items.map((x, i) => (x.u === "m" ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; extra > 0 && pool2.length > 0 && i < 200; i++) {
    const j = pool2[i % pool2.length];
    if (items[j].n < 30) {
      items[j] = { ...items[j], n: items[j].n + 1 };
      extra -= 1;
    } else if (pool2.every((x) => items[x].n >= 30)) break;
  }
  return { name: cleanName(`${opts.minutes}분 ${goal.label}`), items, minutes: classMinutes(items) };
}

/* ───────── ② 오늘 수업 담기 (153 수업 매뉴얼) ───────── */

/**
 * 매뉴얼 분량 → 분/라운드 — 대표님 표현 그대로 읽는다.
 *   「2분 × 3라운드」 → 3라운드 · 「보통 2라운드 (최대 3라운드)」 → 2라운드 · 「3~5라운드 정도」 → 3라운드 ·
 *   「20개 × 3세트」 → 6분(세트마다 2분) · 「5분」 → 5분 · 그 밖 → 5분
 */
export function parseLessonAmount(amount: string): { u: ClassUnit; n: number } {
  const a = amount ?? "";
  const r = a.match(/(\d+)\s*(?:~\s*\d+\s*)?라운드/);
  if (r) return { u: "r", n: clampN("r", Number(r[1])) };
  const set = a.match(/(\d+)\s*세트/);
  if (set) return { u: "m", n: clampN("m", Number(set[1]) * 2) };
  const m = a.match(/(\d+)\s*분/);
  if (m) return { u: "m", n: clampN("m", Number(m[1])) };
  return { u: "m", n: 5 };
}

const normName = (s: string) => s.replace(/[\s·・\-–—()（）[\]/]/g, "").toLowerCase();

/**
 * 매뉴얼 동작 이름 → 같은 카드 — 이름이 같으면 그 카드, 아니면 한쪽 이름이 다른 쪽을 다 품을 때(3글자 이상)만.
 *   글자 차이가 가장 적은 카드 · 비슷한 말(「워밍업 · 줄넘기」 ↔ 「줄넘기 기본」)은 잇지 않는다 — 틀린 동작이 담기느니 건너뛴다.
 */
export function matchCardByName(name: string, cards: readonly { key: TileKey; name: string }[]): TileKey | null {
  const q = normName(name);
  if (q.length < 2) return null;
  let best: { key: TileKey; diff: number } | null = null;
  for (const c of cards) {
    const n = normName(c.name);
    if (!n) continue;
    if (n === q) return c.key;
    const contains = (n.includes(q) && q.length >= 3) || (q.includes(n) && n.length >= 3);
    if (!contains) continue;
    const diff = Math.abs(n.length - q.length);
    if (!best || diff < best.diff) best = { key: c.key, diff };
  }
  return best?.key ?? null;
}

/** 매뉴얼 그날 동작 → 내 수업 항목 (영상 미션 먼저 · 이름이 같은 카드 · 없으면 건너뜀 · 메모 = 매뉴얼 동작 이름) */
export function lessonToClassItems(
  steps: readonly Pick<LessonStep, "name" | "amount" | "videoMissionId">[],
  findCard: (name: string) => TileKey | null,
): { items: ClassItem[]; skipped: string[] } {
  const items: ClassItem[] = [];
  const skipped: string[] = [];
  for (const s of steps) {
    const video = s.videoMissionId ? `m:${s.videoMissionId.trim().toLowerCase()}` : "";
    const key: TileKey | null = isClassKey(video) ? video : findCard(s.name);
    if (!key) {
      skipped.push(s.name);
      continue;
    }
    if (items.length >= MAX_ITEMS) {
      skipped.push(s.name);
      continue;
    }
    const { u, n } = parseLessonAmount(s.amount);
    items.push({ k: key, u, n, note: cleanNote(s.name) });
  }
  return { items, skipped };
}

/** 오늘 수업으로 만든 내 수업 이름 — 「153 수업 1일차」 */
export const lessonClassName = (dayNo: number): string => cleanName(`153 수업 ${dayNo}일차`);
