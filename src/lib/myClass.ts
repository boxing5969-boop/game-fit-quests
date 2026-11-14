/**
 * 🎬 내 수업 — 영상으로 배우기 2단계 (2026-11-14 대표님 「다음 2단계진행」)
 *
 *   회원님 · 코치님이 153 콘텐츠 카드(c:<카드>) · 레벨 미션 영상(m:<미션>)을 「담기」 → 이름 · 순서 · 분(또는 라운드) ·
 *   한 줄 메모로 짠 나만의 수업. 서버 표 training_my_classes (supabase/migrations/20261114230326_training_my_classes.sql).
 *   이 파일은 화면 없는 계산만 — 시험 myClass.test.ts
 *
 *   · 항목 { k, u, n, note } — u = 'm'(분 1~30) · 'r'(라운드 1~12 — 3분 운동 + 사이 30초 쉬기)
 *   · 한도 — 한 사람 20개 · 한 수업 12장 · 이름 24자 · 메모 60자 · 코치 한마디 300자 (서버와 같은 수 · 같은 말)
 *   · 재생 구간(segmentsFor) — 재생 화면이 차례로 걷는다. 영상이 없는 카드도 시간은 같이 간다
 *   · toPlanBlocks — 코치님 「이 수업으로 수업안 만들기」 → 전략 회의 「내 수업 짜기」 블록
 */
import type { ProgramBlock } from "@/services/strategyService";
import { categoryToBlockKind, type TrainingCard } from "@/lib/trainingCards";
import type { TileKey } from "@/lib/shelfLayout";

export const MAX_CLASSES = 20;
export const MAX_ITEMS = 12;
export const NAME_MAX = 24;
export const NOTE_MAX = 60;
export const COACH_NOTE_MAX = 300;
export const MIN_RANGE = { min: 1, max: 30 } as const;
export const ROUND_RANGE = { min: 1, max: 12 } as const;
/** 라운드 한 번 = 3분 운동 */
export const ROUND_SEC = 180;
/** 라운드 사이 쉬기 */
export const REST_SEC = 30;
/** 레벨 미션(워밍업 영상)을 담을 때 기본 분 */
export const MISSION_MINUTES = 5;

export type ClassUnit = "m" | "r";

export interface ClassItem {
  /** c:<카드 id> · m:<미션 id> */
  k: TileKey;
  u: ClassUnit;
  n: number;
  note: string;
}

export interface ClassNoteAuthor {
  name: string;
  title: string;
  avatarUrl: string | null;
}

export interface ClassNote {
  id: string;
  body: string;
  at: string;
  by: ClassNoteAuthor;
  /** 내가 쓴 한마디 (코치님 화면) */
  mine: boolean;
}

export interface MyClass {
  id: string;
  name: string;
  items: ClassItem[];
  shared: boolean;
  sharedAt: string | null;
  updatedAt: string;
  createdAt: string;
  notes: ClassNote[];
  /** 본인 화면에만 — 재생 횟수 · 한 분 · 마지막 · 아직 안 읽은 한마디 */
  plays: number;
  minutesTotal: number;
  lastPlayedAt: string | null;
  newNotes: number;
}

export interface SharedClass {
  id: string;
  name: string;
  items: ClassItem[];
  sharedAt: string | null;
  updatedAt: string;
  notes: ClassNote[];
  owner: { userId: string; name: string; avatarUrl: string | null };
}

const KEY_RE = /^[cm]:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isClassKey = (k: unknown): k is TileKey => typeof k === "string" && KEY_RE.test(k);

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** 이름 다듬기 — 공백 하나로 · 24자 */
export const cleanName = (s: string | null | undefined): string => squash(s ?? "").slice(0, NAME_MAX);
/** 메모 다듬기 — 공백 하나로 · 60자 */
export const cleanNote = (s: string | null | undefined): string => squash(s ?? "").slice(0, NOTE_MAX);

/** 분/라운드 칸 범위 안으로 */
export function clampN(u: ClassUnit, n: number): number {
  const r = u === "r" ? ROUND_RANGE : MIN_RANGE;
  return clamp(Math.round(Number.isFinite(n) ? n : r.min), r.min, r.max);
}

/** DB · 기기 값 → 항목 (모양이 틀린 칸은 버린다 · 12장까지) */
export function parseItems(v: unknown): ClassItem[] {
  if (!Array.isArray(v)) return [];
  const out: ClassItem[] = [];
  for (const x of v) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, unknown>;
    const k = typeof r.k === "string" ? r.k.trim().toLowerCase() : "";
    if (!isClassKey(k)) continue;
    const u: ClassUnit = r.u === "r" ? "r" : "m";
    out.push({ k, u, n: clampN(u, Number(r.n)), note: cleanNote(typeof r.note === "string" ? r.note : "") });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);

function parseNotes(v: unknown): ClassNote[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((n) => {
      const by = (n.by && typeof n.by === "object" ? n.by : {}) as Record<string, unknown>;
      return {
        id: str(n.id),
        body: str(n.body),
        at: str(n.at),
        by: { name: str(by.name) || "코치", title: str(by.title) || "코치", avatarUrl: strOrNull(by.avatar_url) },
        mine: n.mine === true,
      };
    })
    .filter((n) => n.id && n.body);
}

/** 서버 my_classes() 의 한 줄 → 내 수업 */
export function parseMyClass(row: unknown): MyClass | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = str(r.id);
  if (!id) return null;
  return {
    id,
    name: cleanName(str(r.name)) || "내 수업",
    items: parseItems(r.items),
    shared: r.shared === true,
    sharedAt: strOrNull(r.shared_at),
    updatedAt: str(r.updated_at),
    createdAt: str(r.created_at),
    notes: parseNotes(r.notes),
    plays: Math.max(0, Number(r.plays) || 0),
    minutesTotal: Math.max(0, Number(r.minutes_total) || 0),
    lastPlayedAt: strOrNull(r.last_played_at),
    newNotes: Math.max(0, Number(r.new_notes) || 0),
  };
}

/** 서버 class_shared_list() 의 한 줄 → 회원님이 보여 준 수업 */
export function parseSharedClass(row: unknown): SharedClass | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = str(r.id);
  if (!id) return null;
  const o = (r.owner && typeof r.owner === "object" ? r.owner : {}) as Record<string, unknown>;
  return {
    id,
    name: cleanName(str(r.name)) || "내 수업",
    items: parseItems(r.items),
    sharedAt: strOrNull(r.shared_at),
    updatedAt: str(r.updated_at),
    notes: parseNotes(r.notes),
    owner: { userId: str(o.user_id), name: str(o.name) || "회원", avatarUrl: strOrNull(o.avatar_url) },
  };
}

/* ───────── 시간 ───────── */

/** 한 항목의 초 — 분 = n × 60 · 라운드 = n × 3분 + (n − 1) × 30초 */
export function itemSeconds(item: Pick<ClassItem, "u" | "n">): number {
  if (item.u === "r") return item.n * ROUND_SEC + Math.max(0, item.n - 1) * REST_SEC;
  return item.n * 60;
}

/** 수업 합계 초 (없는 카드는 빼고 셀 수 있게 — available) */
export function classSeconds(items: readonly ClassItem[], available?: (k: TileKey) => boolean): number {
  return items.filter((x) => !available || available(x.k)).reduce((s, x) => s + itemSeconds(x), 0);
}

/** 수업 합계 분 (반올림 — 서버 _my_class_minutes 와 같다) */
export const classMinutes = (items: readonly ClassItem[], available?: (k: TileKey) => boolean): number =>
  Math.round(classSeconds(items, available) / 60);

/** 「5분」 · 「3라운드」 */
export const itemAmountText = (item: Pick<ClassItem, "u" | "n">): string => (item.u === "r" ? `${item.n}라운드` : `${item.n}분`);

/** 카드 n장 · n분 */
export function classSummary(items: readonly ClassItem[], available?: (k: TileKey) => boolean): string {
  const list = available ? items.filter((x) => available(x.k)) : items;
  return `카드 ${list.length}장 · ${classMinutes(list)}분`;
}

/** 재생 횟수 — 본인에게만 · 안 한 수업은 말하지 않는다 */
export const playedText = (plays: number): string | null => (plays > 0 ? `${plays}번 했어요` : null);

/** 「오늘 n분 했어요」 — 1분 아래는 1분 */
export const doneText = (seconds: number): string => `오늘 ${Math.max(1, Math.round(seconds / 60))}분 했어요`;

/** m:ss */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ───────── 이름 ───────── */

/** 새 수업 기본 이름 — 「내 수업 1」부터 비어 있는 번호 */
export function defaultClassName(existing: readonly Pick<MyClass, "name">[]): string {
  const used = new Set(existing.map((c) => c.name.trim()));
  for (let i = 1; i <= MAX_CLASSES + 1; i++) {
    const name = `내 수업 ${i}`;
    if (!used.has(name)) return name;
  }
  return "내 수업";
}

/* ───────── 고치기 (늘 새 배열) ───────── */

/** 담기 — 이미 있으면 그대로 · 12장이면 못 담음 */
export function addItem(items: readonly ClassItem[], k: TileKey, minutes: number): { items: ClassItem[]; added: boolean; full: boolean } {
  if (items.some((x) => x.k === k)) return { items: [...items], added: false, full: false };
  if (items.length >= MAX_ITEMS) return { items: [...items], added: false, full: true };
  return { items: [...items, { k, u: "m", n: clampN("m", minutes), note: "" }], added: true, full: false };
}

export function moveItem(items: readonly ClassItem[], i: number, dir: -1 | 1): ClassItem[] {
  const j = i + dir;
  if (i < 0 || i >= items.length || j < 0 || j >= items.length) return [...items];
  const next = [...items];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const removeItemAt = (items: readonly ClassItem[], i: number): ClassItem[] => items.filter((_, j) => j !== i);

export function setItemN(items: readonly ClassItem[], i: number, n: number): ClassItem[] {
  return items.map((x, j) => (j === i ? { ...x, n: clampN(x.u, n) } : x));
}

/** 분 ↔ 라운드 — 분 → 라운드는 3분에 1라운드(반올림 · 1 이상) · 라운드 → 분은 운동 시간(라운드 × 3) */
export function toggleUnit(items: readonly ClassItem[], i: number): ClassItem[] {
  return items.map((x, j) => {
    if (j !== i) return x;
    if (x.u === "m") return { ...x, u: "r" as const, n: clampN("r", Math.max(1, Math.round(x.n / 3))) };
    return { ...x, u: "m" as const, n: clampN("m", x.n * 3) };
  });
}

export function setItemNote(items: readonly ClassItem[], i: number, note: string): ClassItem[] {
  return items.map((x, j) => (j === i ? { ...x, note: note.slice(0, NOTE_MAX) } : x));
}

/** 저장 직전 — 메모 다듬기 · 범위 */
export const normalizeItems = (items: readonly ClassItem[]): ClassItem[] =>
  items.slice(0, MAX_ITEMS).map((x) => ({ k: x.k, u: x.u, n: clampN(x.u, x.n), note: cleanNote(x.note) }));

/** 서버와 같은 말 — 저장 전에 화면에서 먼저 (null = 괜찮음) */
export function validateItems(items: readonly ClassItem[]): string | null {
  if (items.length > MAX_ITEMS) return `한 수업에 ${MAX_ITEMS}장까지 담을 수 있어요`;
  for (const x of items) {
    if (!isClassKey(x.k)) return "수업에 넣을 수 없는 카드예요";
    if (x.u !== "m" && x.u !== "r") return "분 또는 라운드로 정해요";
    const r = x.u === "r" ? ROUND_RANGE : MIN_RANGE;
    if (!Number.isInteger(x.n) || x.n < r.min || x.n > r.max) return "시간은 1~30분 · 1~12라운드로 정해요";
    if (squash(x.note).length > NOTE_MAX) return `메모는 ${NOTE_MAX}자까지 써요`;
  }
  return null;
}

/* ───────── 담겨 있나 ───────── */

export const classesWithKey = <T extends Pick<MyClass, "items">>(classes: readonly T[], k: TileKey): T[] =>
  classes.filter((c) => c.items.some((x) => x.k === k));

export function savedKeySet(classes: readonly Pick<MyClass, "items">[]): Set<TileKey> {
  const s = new Set<TileKey>();
  for (const c of classes) for (const x of c.items) s.add(x.k);
  return s;
}

/* ───────── 재생 구간 ───────── */

export interface Segment {
  /** 항목 번호 (items 안) */
  item: number;
  kind: "work" | "rest";
  /** 라운드면 몇 번째 · 분이면 1 */
  round: number;
  rounds: number;
  sec: number;
}

/**
 * 재생 화면이 차례로 걷는 구간 — 분 = 운동 한 구간 · 라운드 = 3분 운동 · 30초 쉬기 · 3분 운동 …
 * available 이 false 인 항목(꺼진 카드 · 못 찾은 영상)은 건너뛴다.
 */
export function segmentsFor(items: readonly ClassItem[], available?: (k: TileKey) => boolean): Segment[] {
  const out: Segment[] = [];
  items.forEach((x, i) => {
    if (available && !available(x.k)) return;
    if (x.u === "r") {
      for (let r = 1; r <= x.n; r++) {
        out.push({ item: i, kind: "work", round: r, rounds: x.n, sec: ROUND_SEC });
        if (r < x.n) out.push({ item: i, kind: "rest", round: r, rounds: x.n, sec: REST_SEC });
      }
    } else {
      out.push({ item: i, kind: "work", round: 1, rounds: 1, sec: x.n * 60 });
    }
  });
  return out;
}

/** 지난 구간들의 운동 초 — 「오늘 n분 했어요」는 쉬기를 빼고 센다 */
export function workedSeconds(segments: readonly Segment[], index: number, elapsedInCurrent: number): number {
  let s = 0;
  for (let i = 0; i < Math.min(index, segments.length); i++) if (segments[i].kind === "work") s += segments[i].sec;
  const cur = segments[index];
  if (cur && cur.kind === "work") s += Math.max(0, Math.min(cur.sec, elapsedInCurrent));
  return s;
}

/** 다음 항목의 첫 구간 (「다음 →」) — 없으면 -1 */
export function nextItemSegment(segments: readonly Segment[], index: number): number {
  const cur = segments[index];
  if (!cur) return -1;
  for (let i = index + 1; i < segments.length; i++) if (segments[i].item !== cur.item) return i;
  return -1;
}

/** 앞 항목의 첫 구간 (「← 이전」) — 지금 항목을 1초 넘게 했으면 지금 항목의 처음 */
export function prevItemSegment(segments: readonly Segment[], index: number, elapsedInCurrent: number): number {
  const cur = segments[index];
  if (!cur) return 0;
  const first = segments.findIndex((s) => s.item === cur.item);
  if (index > first || elapsedInCurrent > 1) return first;
  for (let i = first - 1; i >= 0; i--) {
    if (segments[i].item !== cur.item) return segments.findIndex((s) => s.item === segments[i].item);
  }
  return first;
}

/* ───────── 코치님 「이 수업으로 수업안 만들기」 ───────── */

export interface PlanCardLookup {
  card: (id: string) => TrainingCard | undefined;
  mission: (id: string) => { id: string; title: string } | undefined;
}

/** 내 수업 항목 → 수업안 블록 (분은 합계 분 · 메모는 블록 메모 · 못 찾은 것은 뺀다) */
export function toPlanBlocks(items: readonly ClassItem[], look: PlanCardLookup): ProgramBlock[] {
  const out: ProgramBlock[] = [];
  for (const x of items) {
    const minutes = Math.max(1, Math.min(120, Math.round(itemSeconds(x) / 60)));
    const id = x.k.slice(2);
    if (x.k.startsWith("c:")) {
      const card = look.card(id);
      if (!card) continue;
      out.push({ kind: categoryToBlockKind(card.category), title: card.name.slice(0, 80), minutes, card_id: card.id, mission_id: null, video_id: null, note: x.note });
    } else {
      const m = look.mission(id);
      if (!m) continue;
      out.push({ kind: "warmup", title: missionTitle(m.title).slice(0, 80), minutes, card_id: null, mission_id: m.id, video_id: null, note: x.note });
    }
  }
  return out;
}

/** 레벨 미션 제목 앞의 [복싱/○○] 꼬리표를 뺀다 (타일 이름과 같게) */
export const missionTitle = (t: string): string => t.replace(/^\s*\[[^\]]*\]\s*/, "");

/* ───────── 날짜 ───────── */

/** 한마디 시각 — 오늘이면 「오후 3:20」 · 아니면 「11/14」 */
export function noteWhen(at: string, now: Date = new Date()): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const kst = (x: Date) => new Date(x.getTime() + 9 * 3600_000);
  const a = kst(d);
  const b = kst(now);
  if (a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)) {
    const h = a.getUTCHours();
    const m = String(a.getUTCMinutes()).padStart(2, "0");
    return `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${m}`;
  }
  return `${a.getUTCMonth() + 1}/${a.getUTCDate()}`;
}
