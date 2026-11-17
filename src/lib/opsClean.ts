/**
 * 153운영본부 「오늘 청소」 1단계 — 화면 없는 계산 · 글 한 곳
 *   (2026-11-16 대표님 「운영본부 탭에 청소 매뉴얼 … 코치님들이 직관적으로 보고 수행할수있도록」 → 「올려서 반영하자」
 *    · 보고서 「153복싱짐 선릉역점 청소 매뉴얼·체크리스트 보고서」)
 *   · 서버 ops_clean_day JSON 읽기 · 구역 묶기 · 진행 숫자 · 남은 시간 · 걸린 시간 · 인수인계 글
 *   · 요일 · 월 1회 규칙 cleanDue = DB _ops_clean_due 와 같은 식
 *   · 검사 말은 서버(ops_clean_check · ops_clean_finish)와 같은 말
 *   DB 20261116211742_ops_clean_stage1.sql · 시험 opsClean.test.ts
 */

export type CleanState = "done" | "hold" | "issue";

export interface CleanItem {
  id: string;
  zone: string;
  title: string;
  min: number;
  doneText: string | null;
  how: string | null;
  caution: string | null;
  /** 요일 미션 · 월 1회 미션 — 「오늘의 미션」 카드로 */
  mission: boolean;
  monthly: boolean;
  state: CleanState | null;
  note: string | null;
  at: string | null;
  byName: string | null;
  /** 2단계 — 대표님 · 지점 관리자가 이 문제를 처리했다 */
  resolved?: boolean;
  resolveNote?: string | null;
}

export interface CleanRun {
  startedAt: string | null;
  finishedAt: string | null;
  note: string | null;
  finishedByName: string | null;
}

export type HandoverKind = "sum" | "note" | "hold" | "issue";

export interface CleanHandover {
  kind: HandoverKind;
  date: string;
  slot: string;
  label: string;
  time: string;
  title: string | null;
  text: string | null;
  byName: string | null;
  done: number;
  due: number;
  finished: boolean;
  /** 2단계 — 처리한 문제 */
  resolved?: boolean;
  resolveNote?: string | null;
  resolvedByName?: string | null;
}

export interface CleanSlot {
  slot: string;
  label: string;
  /** "11:00" */
  time: string;
  /** 시작부터 끝내야 하는 시각까지 (분) */
  budget: number;
  mine: boolean;
  people: string[];
  run: CleanRun | null;
  items: CleanItem[];
  handover: CleanHandover[];
}

export interface CleanBranch {
  branch: string;
  manage: boolean;
  mine: boolean;
}

export interface CleanDay {
  /** 서버에 함수가 있나 (없으면 화면을 숨긴다) */
  available: boolean;
  /** 이 계정이 볼 청소가 있나 */
  on: boolean;
  branch: string;
  branches: CleanBranch[];
  manage: boolean;
  me: string | null;
  date: string;
  today: string;
  /** 휴관일 */
  closed: boolean;
  /** 그 지점 청소가 도는 요일 (0=일 … 6=토) — 비어 있으면 모든 요일로 본다 */
  days: number[];
  slots: CleanSlot[];
}

export const CLEAN_OFF: CleanDay = {
  available: false,
  on: false,
  branch: "",
  branches: [],
  manage: false,
  me: null,
  date: "",
  today: "",
  closed: false,
  days: [],
  slots: [],
};

export const CLEAN_NOTE_MAX = 200;
export const CLEAN_STATE_LABEL: Record<CleanState, string> = { done: "완료", hold: "보류", issue: "문제" };
/** 보류 사유 — 누르면 메모 칸에 채워진다 */
export const CLEAN_HOLD_REASONS = ["회원 사용 중", "시간 부족", "도구 · 세제 없음"] as const;

/** 구역 — 이름 · 한 줄 수칙. 모르는 구역은 글자 그대로 */
export const CLEAN_ZONES: Record<string, { label: string; rule?: string }> = {
  start: { label: "시작" },
  mission: { label: "오늘의 미션" },
  women: {
    label: "여자 구역",
    rule: "노크 → 「청소하겠습니다」 → '청소 중' 팻말 → 문 열어 두기. 회원이 있으면 들어가지 않고 '보류'로 남겨요.",
  },
  men: { label: "남자 구역" },
  ring: { label: "링" },
  entry: { label: "입구" },
  hall: { label: "홀" },
  laundry: { label: "빨래" },
  finish: { label: "마무리" },
  lock: { label: "문단속" },
};
export const zoneLabel = (zone: string): string => CLEAN_ZONES[zone]?.label ?? zone;

/** 지킬 수칙 세 가지 (보고서 「구역별 완료 기준」) */
export const CLEAN_RULES: readonly { title: string; body: string }[] = [
  {
    title: "여자 구역",
    body: "노크 → 「청소하겠습니다」 → '청소 중' 팻말 → 문 열어 두기. 회원이 있으면 들어가지 않고 '보류'로 남겨요.",
  },
  { title: "세제", body: "락스와 다른 세제는 섞지 않아요. 락스 쓰는 날은 환기부터 해요." },
  { title: "걸레 색", body: "빨강 화장실 · 파랑 거울·데스크 · 초록 링 · 회색 바닥. 색이 다르면 그 구역에 쓰지 않아요." },
];

// ── 읽기 ─────────────────────────────────────────────────────

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isState = (v: unknown): v is CleanState => v === "done" || v === "hold" || v === "issue";

const readItem = (raw: unknown): CleanItem | null => {
  const r = obj(raw);
  const id = str(r.id);
  const title = str(r.title).trim();
  if (!id || !title) return null;
  return {
    id,
    zone: str(r.zone) || "hall",
    title,
    min: Math.max(0, Math.round(num(r.min))),
    doneText: strOrNull(r.done_text),
    how: strOrNull(r.how),
    caution: strOrNull(r.caution),
    mission: r.mission === true,
    monthly: r.monthly === true,
    state: isState(r.state) ? r.state : null,
    note: strOrNull(r.note),
    at: strOrNull(r.at),
    byName: strOrNull(r.by_name),
    resolved: r.resolved === true,
    resolveNote: strOrNull(r.resolve_note),
  };
};

const readRun = (raw: unknown): CleanRun | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = obj(raw);
  return {
    startedAt: strOrNull(r.started_at),
    finishedAt: strOrNull(r.finished_at),
    note: strOrNull(r.note),
    finishedByName: strOrNull(r.finished_by_name),
  };
};

const readHandover = (raw: unknown): CleanHandover | null => {
  const r = obj(raw);
  const kind = r.kind;
  if (kind !== "sum" && kind !== "note" && kind !== "hold" && kind !== "issue") return null;
  if (!isDay(r.date)) return null;
  return {
    kind,
    date: r.date,
    slot: str(r.slot),
    label: str(r.label) || str(r.slot),
    time: str(r.time),
    title: strOrNull(r.title),
    text: strOrNull(r.text),
    byName: strOrNull(r.by_name),
    done: Math.max(0, Math.round(num(r.done))),
    due: Math.max(0, Math.round(num(r.due))),
    finished: r.finished === true,
    resolved: r.resolved === true,
    resolveNote: strOrNull(r.resolve_note),
    resolvedByName: strOrNull(r.resolved_by_name),
  };
};

const readSlot = (raw: unknown): CleanSlot | null => {
  const r = obj(raw);
  const slot = str(r.slot);
  const time = str(r.time);
  if (!slot || !/^\d{2}:\d{2}$/.test(time)) return null;
  return {
    slot,
    label: str(r.label) || slot,
    time,
    budget: Math.max(1, Math.round(num(r.budget, 10))),
    mine: r.mine === true,
    people: arr(r.people).filter((p): p is string => typeof p === "string" && p.trim() !== ""),
    run: readRun(r.run),
    items: arr(r.items)
      .map(readItem)
      .filter((i): i is CleanItem => !!i),
    handover: arr(r.handover)
      .map(readHandover)
      .filter((h): h is CleanHandover => !!h),
  };
};

/** 서버 값을 믿지 않고 다듬는다 — 모양이 다르면 꺼진 것으로 */
export const normalizeCleanDay = (raw: unknown): CleanDay => {
  const r = obj(raw);
  if (r.on !== true || !isDay(r.date) || !isDay(r.today)) return { ...CLEAN_OFF, available: true };
  return {
    available: true,
    on: true,
    branch: str(r.branch),
    branches: arr(r.branches)
      .map((b) => {
        const x = obj(b);
        return { branch: str(x.branch), manage: x.manage === true, mine: x.mine === true };
      })
      .filter((b) => !!b.branch),
    manage: r.manage === true,
    me: strOrNull(r.me),
    date: r.date,
    today: r.today,
    closed: r.closed === true,
    days: arr(r.days).filter((d): d is number => typeof d === "number" && Number.isInteger(d) && d >= 0 && d <= 6),
    slots: arr(r.slots)
      .map(readSlot)
      .filter((s): s is CleanSlot => !!s),
  };
};

// ── 날짜 규칙 (DB _ops_clean_due 와 같은 식) ─────────────────

export interface CleanRule {
  /** 하는 요일 (0=일 … 6=토). 없으면 그 시간대가 도는 모든 요일 */
  days?: readonly number[] | null;
  /** 그 달 n번째 … */
  nth?: number | null;
  /** … 무슨 요일의 n번째인지 */
  nthDow?: number | null;
  /** n번째 그 요일에서 며칠 떨어진 날인지 (전날 = -1) */
  off?: number | null;
  /** 하는 달 (1~12). 없으면 매달 */
  months?: readonly number[] | null;
}

const utc = (date: string): Date => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export const cleanDue = (date: string, slotDays: readonly number[], rule: CleanRule): boolean => {
  if (!isDay(date)) return false;
  const d = utc(date);
  const dow = d.getUTCDay();
  if (!slotDays.includes(dow)) return false;
  if (rule.days && !rule.days.includes(dow)) return false;
  const anchor = new Date(d.getTime() - (rule.off ?? 0) * 86_400_000);
  if (rule.months && !rule.months.includes(anchor.getUTCMonth() + 1)) return false;
  if (rule.nth != null) {
    if (anchor.getUTCDay() !== rule.nthDow) return false;
    if (Math.floor((anchor.getUTCDate() - 1) / 7) + 1 !== rule.nth) return false;
  }
  return true;
};

// ── 진행 · 묶기 ──────────────────────────────────────────────

export interface CleanCounts {
  total: number;
  done: number;
  hold: number;
  issue: number;
  /** 상태가 정해진 항목 (완료 + 보류 + 문제) */
  checked: number;
  left: number;
  /** 목표 분 합계 */
  minutes: number;
}

export const slotCounts = (slot: Pick<CleanSlot, "items">): CleanCounts => {
  const c = { total: slot.items.length, done: 0, hold: 0, issue: 0, checked: 0, left: 0, minutes: 0 };
  for (const i of slot.items) {
    c.minutes += i.min;
    if (i.state === "done") c.done += 1;
    else if (i.state === "hold") c.hold += 1;
    else if (i.state === "issue") c.issue += 1;
  }
  c.checked = c.done + c.hold + c.issue;
  c.left = c.total - c.checked;
  return c;
};

export type CleanStatus = "idle" | "doing" | "finished";

export const slotStatus = (slot: CleanSlot): CleanStatus => {
  if (slot.run?.finishedAt) return "finished";
  if (slot.run?.startedAt || slot.items.some((i) => i.state)) return "doing";
  return "idle";
};

export interface ZoneGroup {
  zone: string;
  label: string;
  rule: string | null;
  items: CleanItem[];
  minutes: number;
  checked: number;
}

/** 동선 순서 그대로 — 이어지는 같은 구역끼리 묶는다 (미션은 따로 「오늘의 미션」 카드) */
export const zoneGroups = (items: readonly CleanItem[]): ZoneGroup[] => {
  const out: ZoneGroup[] = [];
  for (const i of items) {
    if (i.mission) continue;
    const last = out[out.length - 1];
    if (last && last.zone === i.zone) {
      last.items.push(i);
      last.minutes += i.min;
      if (i.state) last.checked += 1;
    } else {
      out.push({
        zone: i.zone,
        label: zoneLabel(i.zone),
        rule: CLEAN_ZONES[i.zone]?.rule ?? null,
        items: [i],
        minutes: i.min,
        checked: i.state ? 1 : 0,
      });
    }
  }
  return out;
};

export const missionItems = (items: readonly CleanItem[]): CleanItem[] => items.filter((i) => i.mission);

export type CleanSection =
  | { kind: "mission"; key: string; items: CleanItem[]; minutes: number; checked: number }
  | ({ kind: "zone"; key: string } & ZoneGroup);

/** 화면에 그릴 순서 — 동선 그대로: 이어지는 미션은 「오늘의 미션」 한 묶음, 나머지는 이어지는 같은 구역끼리 */
export const cleanSections = (items: readonly CleanItem[]): CleanSection[] => {
  const out: CleanSection[] = [];
  for (const i of items) {
    const last = out[out.length - 1];
    if (i.mission) {
      if (last?.kind === "mission") {
        last.items.push(i);
        last.minutes += i.min;
        if (i.state) last.checked += 1;
      } else {
        out.push({ kind: "mission", key: `mission-${out.length}`, items: [i], minutes: i.min, checked: i.state ? 1 : 0 });
      }
    } else if (last?.kind === "zone" && last.zone === i.zone) {
      last.items.push(i);
      last.minutes += i.min;
      if (i.state) last.checked += 1;
    } else {
      out.push({
        kind: "zone",
        key: `${i.zone}-${out.length}`,
        zone: i.zone,
        label: zoneLabel(i.zone),
        rule: CLEAN_ZONES[i.zone]?.rule ?? null,
        items: [i],
        minutes: i.min,
        checked: i.state ? 1 : 0,
      });
    }
  }
  return out;
};

/** "2026-11-17T02:32:00Z" → "11:32" (한국 시간) */
export const cleanHm = (iso: string | null): string => {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const k = new Date(t + 9 * 3_600_000);
  return `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`;
};

/** 날짜 옮기기 "2026-11-17" + 1 → "2026-11-18" */
export const shiftCleanDay = (date: string, days: number): string => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

/**
 * 관리자 날짜 넘기기 — 청소가 도는 요일만 밟는다(월요일의 앞 날 = 금요일).
 *   min ~ max(오늘) 밖으로는 못 간다 · 갈 날이 없으면 null. 오늘은 청소 없는 요일이어도 돌아올 수 있다.
 */
export const stepCleanDay = (date: string, dir: -1 | 1, days: readonly number[], min: string, max: string): string | null => {
  let d = date;
  for (let i = 0; i < 8; i++) {
    d = shiftCleanDay(d, dir);
    if (d < min || d > max) return null;
    if (d === max || days.length === 0 || days.includes(utc(d).getUTCDay())) return d;
  }
  return null;
};

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"] as const;
export const weekdayWord = (date: string): string => (isDay(date) ? WEEKDAY[utc(date).getUTCDay()] : "");
/** "2026-11-17" → "11월 17일 (화)" */
export const cleanDayLabel = (date: string): string => {
  if (!isDay(date)) return "";
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일 (${weekdayWord(date)})`;
};
/** 「오늘의 미션」 카드 제목 — 월 1회 미션이 끼면 알려 준다 */
export const missionHeading = (date: string, items: readonly CleanItem[]): string => {
  const m = missionItems(items);
  const base = `${weekdayWord(date)}요일 미션`;
  return m.some((i) => i.monthly) ? `${base} · 월 1회 미션` : base;
};

// ── 시간 ─────────────────────────────────────────────────────

const pad = (n: number): string => String(n).padStart(2, "0");
const hmToMin = (hm: string): number => {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
};
const minToHm = (min: number): string => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;

/** 끝내야 하는 시각 "11:50" */
export const slotEndLabel = (slot: Pick<CleanSlot, "time" | "budget">): string => minToHm(hmToMin(slot.time) + slot.budget);

/** 그날 그 시각(한국 시간)의 ms */
export const kstMs = (date: string, hm: string): number => Date.parse(`${date}T${hm}:00+09:00`);

/** 걸린 시간(분) — 시작 · 끝이 있고 6시간 안일 때만 */
export const elapsedMinutes = (run: CleanRun | null): number | null => {
  if (!run?.startedAt || !run.finishedAt) return null;
  const min = Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 60_000);
  return Number.isFinite(min) && min >= 0 && min <= 360 ? min : null;
};

export type CleanTimer =
  | { kind: "past" }
  | { kind: "finished"; minutes: number | null }
  | { kind: "idle"; endLabel: string; budget: number; leftMin: number }
  | { kind: "running"; endLabel: string; leftMin: number; overMin: number };

/** 맨 위 큰 숫자 — 끝내야 하는 시각까지 남은 분 (시작 전 · 하는 중 · 끝 · 지난 날) */
export const cleanTimer = (slot: CleanSlot, date: string, today: string, nowMs: number): CleanTimer => {
  const status = slotStatus(slot);
  if (status === "finished") return { kind: "finished", minutes: elapsedMinutes(slot.run) };
  if (date !== today) return { kind: "past" };
  const endMs = kstMs(date, slot.time) + slot.budget * 60_000;
  const diff = Math.round((endMs - nowMs) / 60_000);
  const endLabel = slotEndLabel(slot);
  if (status === "idle") return { kind: "idle", endLabel, budget: slot.budget, leftMin: Math.max(0, Math.min(diff, 24 * 60)) };
  return { kind: "running", endLabel, leftMin: Math.max(0, diff), overMin: Math.max(0, -diff) };
};

// ── 검사 말 (서버와 같은 말) ─────────────────────────────────

export const cleanNoteError = (state: CleanState | null, note: string): string | null => {
  const t = note.replace(/\s+/g, " ").trim();
  if (state === "issue" && t.length < 2) return "무엇이 문제인지 한 줄 적어 주세요";
  if (t.length > CLEAN_NOTE_MAX) return `메모는 ${CLEAN_NOTE_MAX}자까지 쓸 수 있어요`;
  return null;
};

/** 끝내기 전에 — 아직 상태를 정하지 않은 항목이 있으면 그 말 */
export const finishBlock = (slot: Pick<CleanSlot, "items">): string | null => {
  const left = slotCounts(slot).left;
  return left > 0 ? `아직 체크하지 않은 항목이 ${left}개 있어요` : null;
};

// ── 화면 글 ──────────────────────────────────────────────────

/** 목록 한 줄 오른쪽 — 시작 전 · 7 / 13 · 끝 47분 */
export const slotStatusText = (slot: CleanSlot): string => {
  const c = slotCounts(slot);
  const s = slotStatus(slot);
  if (s === "finished") {
    const m = elapsedMinutes(slot.run);
    return m == null ? "끝" : `끝 · ${m}분`;
  }
  if (s === "doing") return `${c.checked} / ${c.total}`;
  return "시작 전";
};

/** 목록 한 줄 아래 — 오늘 미션 이름(없으면 항목 수 · 목표 분) */
export const slotSubLine = (slot: CleanSlot): string => {
  const c = slotCounts(slot);
  const m = missionItems(slot.items);
  const base = `${c.total}개 · ${c.minutes}분`;
  return m.length > 0 ? `${base} · 미션 ${m[0].title}${m.length > 1 ? ` 외 ${m.length - 1}` : ""}` : base;
};

const dayDiff = (a: string, b: string): number => Math.round((utc(b).getTime() - utc(a).getTime()) / 86_400_000);

/** 인수인계 줄의 '언제' — 오늘 · 어제 · 어젯밤 · 11/13(금) */
export const handoverWhen = (h: Pick<CleanHandover, "date" | "time">, date: string): string => {
  const diff = dayDiff(h.date, date);
  if (diff === 0) return "오늘";
  if (diff === 1) return h.time >= "18:00" ? "어젯밤" : "어제";
  const [, m, d] = h.date.split("-").map(Number);
  return `${m}/${d}(${weekdayWord(h.date)})`;
};

export interface HandoverView {
  tone: "plain" | "hold" | "issue";
  badge: string | null;
  main: string;
  sub: string | null;
}

export const handoverView = (h: CleanHandover, date: string): HandoverView => {
  const when = `${handoverWhen(h, date)} ${h.label}`;
  if (h.kind === "sum") {
    return { tone: "plain", badge: null, main: `${when} ${h.done}/${h.due}${h.finished ? " · 끝" : ""}`, sub: null };
  }
  if (h.kind === "note") {
    return { tone: "plain", badge: "한마디", main: h.text ?? "", sub: [when, h.byName].filter(Boolean).join(" · ") };
  }
  if (h.kind === "issue" && h.resolved) {
    return {
      tone: "plain",
      badge: "처리됨",
      main: h.text ? `${h.title ?? ""} · ${h.text}` : (h.title ?? ""),
      sub: [when, h.byName, h.resolveNote ? `처리 · ${h.resolveNote}` : h.resolvedByName ? `${h.resolvedByName} 처리` : null].filter(Boolean).join(" · "),
    };
  }
  return {
    tone: h.kind,
    badge: CLEAN_STATE_LABEL[h.kind],
    main: h.text ? `${h.title ?? ""} · ${h.text}` : (h.title ?? ""),
    sub: [when, h.byName].filter(Boolean).join(" · "),
  };
};

/** 끝낸 뒤 한 줄 — 잘한 것부터 */
export const finishLine = (slot: CleanSlot): string => {
  const c = slotCounts(slot);
  const parts = [`완료 ${c.done}`];
  if (c.hold > 0) parts.push(`보류 ${c.hold}`);
  if (c.issue > 0) parts.push(`문제 ${c.issue}`);
  return parts.join(" · ");
};

// ── 고르기 · 고치기 ──────────────────────────────────────────

/** 처음 열 시간대 — 링크로 온 것 → 내 차례(안 끝난 것) → 지금 시각에 가까운 안 끝난 것 → 첫 칸 */
export const pickSlot = (day: CleanDay, wanted: string | null, nowMs: number): CleanSlot | null => {
  if (day.slots.length === 0) return null;
  const byKey = wanted ? day.slots.find((s) => s.slot === wanted) : null;
  if (byKey) return byKey;
  const open = day.slots.filter((s) => slotStatus(s) !== "finished");
  const mine = open.find((s) => s.mine);
  if (mine) return mine;
  if (day.date === day.today) {
    const started = open.filter((s) => kstMs(day.date, s.time) <= nowMs);
    if (started.length > 0) return started[started.length - 1];
  }
  return open[0] ?? day.slots[0];
};

/** 누르는 순간 화면에 먼저 — 그 항목의 상태만 바꾼 새 값 */
export const withItemState = (day: CleanDay, itemId: string, state: CleanState | null, note: string | null, byName: string | null, nowIso: string): CleanDay => ({
  ...day,
  slots: day.slots.map((s) => {
    if (!s.items.some((i) => i.id === itemId)) return s;
    const items = s.items.map((i) =>
      i.id === itemId
        ? { ...i, state, note: state === "hold" || state === "issue" ? note : null, at: state ? nowIso : null, byName: state ? (byName ?? i.byName) : null, resolved: false, resolveNote: null }
        : i,
    );
    const startedNow = state && day.date === day.today && !s.run?.startedAt;
    const run: CleanRun | null = startedNow
      ? { startedAt: nowIso, finishedAt: s.run?.finishedAt ?? null, note: s.run?.note ?? null, finishedByName: s.run?.finishedByName ?? null }
      : s.run;
    return { ...s, items, run };
  }),
});

/** 내 차례 가운데 아직 안 끝난 시간대 (홈 · 운영본부 맨 위 카드) */
export const myOpenSlots = (day: CleanDay): CleanSlot[] => (day.on && !day.closed ? day.slots.filter((s) => s.mine && slotStatus(s) !== "finished") : []);
