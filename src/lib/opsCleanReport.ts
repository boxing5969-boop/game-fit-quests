/**
 * 153운영본부 「오늘 청소」 2단계 — 현황 · 문제 처리 · 항목 · 시간대 고치기 (화면 없는 계산 · 글 한 곳)
 *   (2026-11-17 대표님 「1단계 추천대로 적용하고 다음단계가자」 · 보고서 제작 순서 2단계)
 *   · 서버 ops_clean_report JSON 읽기 · 주마다 요일 × 시간대 칸 · 완료율 · 항목별 보통 걸린 분 · 문제
 *   · 고치기 초안 · 검사 말(서버 ops_clean_item_save · ops_clean_slot_save 와 같은 말) · 요일마다 목표 분
 *   DB 20261117105547_ops_clean_stage2.sql · 시험 opsCleanReport.test.ts
 */
import { CLEAN_ZONES, cleanDue, shiftCleanDay, weekdayWord, zoneLabel, type CleanRule } from "./opsClean";

export interface ReportSlot {
  id: string;
  slot: string;
  label: string;
  time: string;
  budget: number;
  weekdays: number[];
  /** 시작 뒤 몇 분에 미완료 알림 (null = 끔) */
  alertMin: number | null;
  /** 밤 10시 ~ 아침 8시에도 휴대폰으로 */
  alertLoud: boolean;
  assignee: string | null;
  assigneeName: string | null;
}

export interface ReportRun {
  slot: string;
  due: number;
  done: number;
  hold: number;
  issue: number;
  startedAt: string | null;
  finishedAt: string | null;
  note: string | null;
  finishedByName: string | null;
}

export interface ReportDay {
  date: string;
  closed: boolean;
  runs: ReportRun[];
}

export interface ReportItem {
  id: string;
  slot: string;
  slotId: string;
  zone: string;
  title: string;
  min: number;
  doneText: string | null;
  how: string | null;
  caution: string | null;
  mission: boolean;
  days: number[] | null;
  nth: number | null;
  nthDow: number | null;
  off: number;
  months: number[] | null;
  sort: number;
  active: boolean;
  dueN: number;
  doneN: number;
  holdN: number;
  issueN: number;
  /** 걸린 분을 잰 횟수 */
  samples: number;
  /** 보통 걸린 분 (가운데 값) */
  typical: number | null;
}

export interface ReportIssue {
  itemId: string;
  date: string;
  slot: string;
  label: string;
  title: string;
  note: string | null;
  byName: string | null;
  at: string | null;
  resolvedAt: string | null;
  resolvedByName: string | null;
  resolveNote: string | null;
}

export interface ReportStaff {
  id: string;
  name: string;
}

export interface CleanReport {
  available: boolean;
  on: boolean;
  branch: string;
  branches: { branch: string; mine: boolean }[];
  today: string;
  /** 서버 시각 "HH:MM" (한국) */
  now: string;
  from: string;
  to: string;
  slots: ReportSlot[];
  days: ReportDay[];
  items: ReportItem[];
  issues: ReportIssue[];
  staff: ReportStaff[];
}

export const REPORT_OFF: CleanReport = {
  available: false,
  on: false,
  branch: "",
  branches: [],
  today: "",
  now: "00:00",
  from: "",
  to: "",
  slots: [],
  days: [],
  items: [],
  issues: [],
  staff: [],
};

// ── 읽기 ─────────────────────────────────────────────────────

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown, d = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : d);
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number.isFinite(num(v, NaN)) ? num(v) : null);
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const ints = (v: unknown, lo: number, hi: number): number[] | null => {
  if (!Array.isArray(v)) return null;
  const out = [...new Set(v.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= lo && n <= hi))].sort((a, b) => a - b);
  return out.length > 0 ? out : null;
};
const count = (v: unknown): number => Math.max(0, Math.round(num(v)));

const readSlot = (raw: unknown): ReportSlot | null => {
  const r = obj(raw);
  const id = str(r.id);
  const slot = str(r.slot);
  const time = str(r.time);
  if (!id || !slot || !/^\d{2}:\d{2}$/.test(time)) return null;
  const alert = numOrNull(r.alert_min);
  return {
    id,
    slot,
    label: str(r.label) || slot,
    time,
    budget: Math.max(1, Math.round(num(r.budget, 10))),
    weekdays: ints(r.weekdays, 0, 6) ?? [1, 2, 3, 4, 5],
    alertMin: alert === null ? null : Math.max(0, Math.round(alert)),
    alertLoud: r.alert_loud === true,
    assignee: strOrNull(r.assignee),
    assigneeName: strOrNull(r.assignee_name),
  };
};

const readRun = (raw: unknown): ReportRun | null => {
  const r = obj(raw);
  const slot = str(r.slot);
  if (!slot) return null;
  return {
    slot,
    due: count(r.due),
    done: count(r.done),
    hold: count(r.hold),
    issue: count(r.issue),
    startedAt: strOrNull(r.started_at),
    finishedAt: strOrNull(r.finished_at),
    note: strOrNull(r.note),
    finishedByName: strOrNull(r.finished_by_name),
  };
};

const readItem = (raw: unknown): ReportItem | null => {
  const r = obj(raw);
  const id = str(r.id);
  const title = str(r.title).trim();
  if (!id || !title) return null;
  const nth = numOrNull(r.month_nth);
  const typical = numOrNull(r.typical);
  return {
    id,
    slot: str(r.slot),
    slotId: str(r.slot_id),
    zone: str(r.zone) || "hall",
    title,
    min: count(r.min),
    doneText: strOrNull(r.done_text),
    how: strOrNull(r.how),
    caution: strOrNull(r.caution),
    mission: r.mission === true,
    days: ints(r.weekdays, 0, 6),
    nth: nth === null ? null : Math.round(nth),
    nthDow: nth === null ? null : Math.round(num(r.nth_dow)),
    off: Math.round(num(r.day_offset)),
    months: ints(r.months, 1, 12),
    sort: Math.round(num(r.sort)),
    active: r.active !== false,
    dueN: count(r.due_n),
    doneN: count(r.done_n),
    holdN: count(r.hold_n),
    issueN: count(r.issue_n),
    samples: count(r.samples),
    typical: typical === null ? null : Math.round(typical * 10) / 10,
  };
};

const readIssue = (raw: unknown): ReportIssue | null => {
  const r = obj(raw);
  const itemId = str(r.item_id);
  if (!itemId || !isDay(r.date)) return null;
  return {
    itemId,
    date: r.date,
    slot: str(r.slot),
    label: str(r.label) || str(r.slot),
    title: str(r.title) || "청소 항목",
    note: strOrNull(r.note),
    byName: strOrNull(r.by_name),
    at: strOrNull(r.at),
    resolvedAt: strOrNull(r.resolved_at),
    resolvedByName: strOrNull(r.resolved_by_name),
    resolveNote: strOrNull(r.resolve_note),
  };
};

/** 서버 값을 믿지 않고 다듬는다 — 모양이 다르면 꺼진 것으로 */
export const normalizeCleanReport = (raw: unknown): CleanReport => {
  const r = obj(raw);
  if (r.on !== true || !isDay(r.today) || !isDay(r.from) || !isDay(r.to)) return { ...REPORT_OFF, available: true };
  return {
    available: true,
    on: true,
    branch: str(r.branch),
    branches: arr(r.branches)
      .map((b) => {
        const x = obj(b);
        return { branch: str(x.branch), mine: x.mine === true };
      })
      .filter((b) => !!b.branch),
    today: r.today,
    now: /^\d{2}:\d{2}$/.test(str(r.now)) ? str(r.now) : "00:00",
    from: r.from,
    to: r.to,
    slots: arr(r.slots)
      .map(readSlot)
      .filter((s): s is ReportSlot => !!s),
    days: arr(r.days)
      .map((d) => {
        const x = obj(d);
        if (!isDay(x.date)) return null;
        return {
          date: x.date,
          closed: x.closed === true,
          runs: arr(x.runs)
            .map(readRun)
            .filter((u): u is ReportRun => !!u),
        };
      })
      .filter((d): d is ReportDay => !!d)
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
    items: arr(r.items)
      .map(readItem)
      .filter((i): i is ReportItem => !!i),
    issues: arr(r.issues)
      .map(readIssue)
      .filter((i): i is ReportIssue => !!i),
    staff: arr(r.staff)
      .map((s) => {
        const x = obj(s);
        return { id: str(x.id), name: str(x.name) };
      })
      .filter((s) => !!s.id && !!s.name),
  };
};

// ── 칸 · 주 ──────────────────────────────────────────────────

const hmMin = (hm: string): number => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const dow = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();
export const mondayOf = (date: string): string => shiftCleanDay(date, -((dow(date) + 6) % 7));
const md = (date: string): string => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
/** "11/14(금)" */
export const reportDayLabel = (date: string): string => `${md(date)}(${weekdayWord(date)})`;

/** 기간 — n주(이번 주 포함) · 월요일부터 오늘까지 */
export const reportRange = (today: string, weeks: number): { from: string; to: string } => ({
  from: shiftCleanDay(mondayOf(today), -7 * (Math.max(1, Math.round(weeks)) - 1)),
  to: today,
});

export type CellKind = "off" | "closed" | "wait" | "doing" | "finished" | "partial" | "none" | "empty";

export interface ReportCell {
  kind: CellKind;
  run: ReportRun | null;
  /** 끝낸 시간대 — 시작부터 끝까지 분 */
  minutes: number | null;
}

const minutesBetween = (a: string | null, b: string | null): number | null => {
  if (!a || !b) return null;
  const d = (Date.parse(b) - Date.parse(a)) / 60_000;
  return Number.isFinite(d) && d >= 0 ? Math.max(1, Math.round(d)) : null;
};

/** 그날 그 시간대 칸 — 끝 · 진행 · 아직 · 일부만 · 안 함 · 휴관 · 없는 날 */
export const reportCell = (rep: Pick<CleanReport, "today" | "now">, day: ReportDay | undefined, slot: ReportSlot): ReportCell => {
  if (!day) return { kind: "off", run: null, minutes: null };
  if (day.closed) return { kind: "closed", run: null, minutes: null };
  const run = day.runs.find((r) => r.slot === slot.slot) ?? null;
  if (!run) return { kind: "off", run: null, minutes: null };
  if (run.due === 0) return { kind: "empty", run, minutes: null };
  if (run.finishedAt) return { kind: "finished", run, minutes: minutesBetween(run.startedAt, run.finishedAt) };
  const checked = run.done + run.hold + run.issue;
  const passed = day.date < rep.today || (day.date === rep.today && hmMin(rep.now) >= hmMin(slot.time) + slot.budget);
  if (!passed) return { kind: run.startedAt || checked > 0 ? "doing" : "wait", run, minutes: null };
  return { kind: checked > 0 ? "partial" : "none", run, minutes: null };
};

export interface ReportWeek {
  monday: string;
  label: string;
  dates: string[];
  /** 완료율 % — 끝낼 시각이 지난 칸만 (없으면 null) */
  rate: number | null;
  finished: number;
  counted: number;
}

/** 주마다 — 최근 주 먼저 · 청소가 도는 날만 */
export const reportWeeks = (rep: CleanReport): ReportWeek[] => {
  const thisMon = mondayOf(rep.today);
  const lastMon = shiftCleanDay(thisMon, -7);
  const byMon = new Map<string, ReportDay[]>();
  for (const d of rep.days) {
    const m = mondayOf(d.date);
    byMon.set(m, [...(byMon.get(m) ?? []), d]);
  }
  return [...byMon.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([monday, days]) => {
      let done = 0;
      let due = 0;
      let finished = 0;
      let counted = 0;
      for (const d of days) {
        for (const s of rep.slots) {
          const c = reportCell(rep, d, s);
          if (c.kind === "finished" || c.kind === "partial" || c.kind === "none") {
            counted += 1;
            if (c.kind === "finished") finished += 1;
            done += c.run?.done ?? 0;
            due += c.run?.due ?? 0;
          }
        }
      }
      return {
        monday,
        label: monday === thisMon ? "이번 주" : monday === lastMon ? "지난주" : `${md(monday)} 주`,
        dates: days.map((d) => d.date),
        rate: due > 0 ? Math.round((done / due) * 100) : null,
        finished,
        counted,
      };
    });
};

/** 칸을 눌렀을 때 한 줄 — "11/14(금) 오픈 · 완료 12/13 · 보류 1 · 42분 · 끝 예시 코치 A" */
export const cellLine = (date: string, slot: ReportSlot, cell: ReportCell): string => {
  const head = `${reportDayLabel(date)} ${slot.label}`;
  if (cell.kind === "closed") return `${head} · 휴관일`;
  if (cell.kind === "off") return `${head} · 청소가 없는 날`;
  const r = cell.run;
  if (!r || cell.kind === "empty") return `${head} · 할 항목이 없었어요`;
  if (cell.kind === "wait") return `${head} · ${slot.time} 시작 전`;
  const parts = [head, `완료 ${r.done}/${r.due}`];
  if (r.hold > 0) parts.push(`보류 ${r.hold}`);
  if (r.issue > 0) parts.push(`문제 ${r.issue}`);
  if (cell.minutes !== null) parts.push(`${cell.minutes}분`);
  if (cell.kind === "finished") parts.push(r.finishedByName ? `끝 ${r.finishedByName}` : "끝");
  else if (cell.kind === "doing") parts.push("진행 중");
  else if (cell.kind === "none") parts.push("체크 기록 없음");
  else parts.push("끝내기 전");
  return parts.join(" · ");
};

// ── 항목별 걸린 분 ───────────────────────────────────────────

/** 이만큼 잰 항목만 '보통 n분'을 보여 준다 */
export const TYPICAL_MIN_SAMPLES = 3;

export type ItemFlag = "long" | "short" | "hold";
export const ITEM_FLAG_LABEL: Record<ItemFlag, string> = { long: "목표보다 오래", short: "목표보다 빨리", hold: "보류가 잦아요" };

export const itemFlag = (i: Pick<ReportItem, "min" | "samples" | "typical" | "dueN" | "holdN">): ItemFlag | null => {
  if (i.samples >= TYPICAL_MIN_SAMPLES && i.typical !== null) {
    if (i.typical >= i.min + 2 && i.typical >= i.min * 1.3) return "long";
    if (i.min >= 3 && i.min - i.typical >= 2 && i.typical <= i.min * 0.6) return "short";
  }
  if (i.dueN >= 3 && i.holdN >= 2 && i.holdN / i.dueN >= 0.3) return "hold";
  return null;
};

const minText = (n: number): string => `${Number.isInteger(n) ? n : n.toFixed(1)}분`;

/** "보통 7분 · 목표 5분 · 6번 잼" / "목표 5분 · 잰 기록 2번" / "목표 5분" */
export const itemStatLine = (i: Pick<ReportItem, "min" | "samples" | "typical" | "holdN" | "issueN">): string => {
  const parts: string[] = [];
  if (i.samples >= TYPICAL_MIN_SAMPLES && i.typical !== null) parts.push(`보통 ${minText(i.typical)}`, `목표 ${i.min}분`, `${i.samples}번 잼`);
  else {
    parts.push(`목표 ${i.min}분`);
    if (i.samples > 0) parts.push(`잰 기록 ${i.samples}번`);
  }
  if (i.holdN > 0) parts.push(`보류 ${i.holdN}번`);
  if (i.issueN > 0) parts.push(`문제 ${i.issueN}번`);
  return parts.join(" · ");
};

// ── 문제 ─────────────────────────────────────────────────────

export const openIssues = (rep: CleanReport): ReportIssue[] => rep.issues.filter((i) => !i.resolvedAt);
export const doneIssues = (rep: CleanReport): ReportIssue[] => rep.issues.filter((i) => !!i.resolvedAt);
export const RESOLVE_NOTE_MAX = 200;
export const RESOLVE_PRESETS = ["고쳤어요", "새로 채웠어요", "업체에 맡겼어요"] as const;
export const resolveNoteError = (note: string): string | null =>
  note.replace(/\s+/g, " ").trim().length > RESOLVE_NOTE_MAX ? "메모는 200자까지 쓸 수 있어요" : null;

// ── 고치기 ───────────────────────────────────────────────────

/** 고를 수 있는 구역 (동선 순서) — 'mission' = 「오늘의 미션」 카드 */
export const EDIT_ZONES = ["start", "mission", "women", "men", "ring", "entry", "hall", "laundry", "finish", "lock"] as const;
export const editZoneLabel = (zone: string): string => zoneLabel(zone);
export const editZoneRule = (zone: string): string | null => CLEAN_ZONES[zone]?.rule ?? null;

export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const NTH = ["", "첫째", "둘째", "셋째", "넷째", "다섯째"];
export const dowWord = (d: number): string => DOW[d] ?? "";
export const nthWord = (n: number): string => NTH[n] ?? "";

export const ruleOf = (i: Pick<ReportItem, "days" | "nth" | "nthDow" | "off" | "months">): CleanRule => ({
  days: i.days,
  nth: i.nth,
  nthDow: i.nthDow,
  off: i.off,
  months: i.months,
});

const offWord = (off: number): string => (off === 0 ? "" : off === -1 ? " 전날" : off === 1 ? " 다음 날" : off < 0 ? ` ${-off}일 전` : ` ${off}일 뒤`);
const sameSet = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((x) => b.includes(x));
const weekSort = (days: readonly number[]): number[] => [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));

/** "매일" · "월 · 수 · 금" · "첫째 수요일 전날 · 3 · 6 · 9 · 12월" */
export const ruleText = (i: Pick<ReportItem, "days" | "nth" | "nthDow" | "off" | "months">, slotDays: readonly number[]): string => {
  let base: string;
  if (i.nth !== null && i.nthDow !== null) base = `${nthWord(i.nth)} ${dowWord(i.nthDow)}요일${offWord(i.off)}`;
  else if (i.days && !sameSet(i.days.filter((d) => slotDays.includes(d)), slotDays)) base = weekSort(i.days).map(dowWord).join(" · ");
  else base = "매일";
  return i.months && i.months.length < 12 ? `${base} · ${i.months.join(" · ")}월` : base;
};

export interface SlotDayMinutes {
  dow: number;
  min: number;
  max: number;
}

/** 요일마다 목표 분 합 — 앞으로 5주 동안 그 요일의 가장 적은 · 많은 날 (월 1회 미션이 있는 날은 많아진다) */
export const slotWeekMinutes = (slot: Pick<ReportSlot, "id" | "weekdays">, items: readonly ReportItem[], from: string): SlotDayMinutes[] => {
  const mine = items.filter((i) => i.active && i.slotId === slot.id);
  return weekSort(slot.weekdays).map((d) => {
    const totals: number[] = [];
    for (let k = 0; k < 35; k += 1) {
      const date = shiftCleanDay(from, k);
      if (dow(date) !== d) continue;
      totals.push(mine.reduce((n, i) => n + (cleanDue(date, slot.weekdays, ruleOf(i)) ? i.min : 0), 0));
    }
    return { dow: d, min: Math.min(...totals), max: Math.max(...totals) };
  });
};

export interface EditSection {
  key: string;
  zone: string;
  label: string;
  items: ReportItem[];
}

/** 고치기 화면 묶음 — 동선 순서 그대로, 이어지는 미션은 「오늘의 미션」, 나머지는 이어지는 같은 구역끼리 */
export const editSections = (items: readonly ReportItem[]): EditSection[] => {
  const out: EditSection[] = [];
  for (const i of items) {
    const zone = i.mission ? "mission" : i.zone;
    const last = out[out.length - 1];
    if (last && last.zone === zone) last.items.push(i);
    else out.push({ key: `${zone}-${out.length}`, zone, label: zoneLabel(zone), items: [i] });
  }
  return out;
};

/** 시간대의 넣은 항목 (순서대로) */
export const slotItems = (rep: Pick<CleanReport, "items">, slotId: string, active = true): ReportItem[] =>
  rep.items.filter((i) => i.slotId === slotId && i.active === active);

/** 같은 묶음 안에서 한 칸 위 · 아래 — 새 순서(아이디 목록), 못 옮기면 null */
export const moveInSection = (ordered: readonly ReportItem[], id: string, dir: -1 | 1): string[] | null => {
  const idx = ordered.findIndex((i) => i.id === id);
  const j = idx + dir;
  if (idx < 0 || j < 0 || j >= ordered.length) return null;
  const zone = (i: ReportItem) => (i.mission ? "mission" : i.zone);
  if (zone(ordered[idx]) !== zone(ordered[j])) return null;
  const ids = ordered.map((i) => i.id);
  [ids[idx], ids[j]] = [ids[j], ids[idx]];
  return ids;
};

export type ItemWhen = "all" | "days" | "month";

export interface ItemDraft {
  id: string | null;
  slotId: string;
  zone: string;
  title: string;
  min: string;
  doneText: string;
  how: string;
  caution: string;
  when: ItemWhen;
  days: number[];
  nth: number;
  nthDow: number;
  off: number;
  /** 한 달에 한 번일 때 하는 달 — 비우면 모든 달 */
  months: number[];
  active: boolean;
}

export const newItemDraft = (slot: Pick<ReportSlot, "id" | "weekdays">, zone = "hall"): ItemDraft => ({
  id: null,
  slotId: slot.id,
  zone,
  title: "",
  min: "3",
  doneText: "",
  how: "",
  caution: "",
  when: "all",
  days: weekSort(slot.weekdays),
  nth: 1,
  nthDow: slot.weekdays.includes(3) ? 3 : (slot.weekdays[0] ?? 1),
  off: 0,
  months: [],
  active: true,
});

export const itemDraftOf = (i: ReportItem, slot?: Pick<ReportSlot, "weekdays">): ItemDraft => ({
  id: i.id,
  slotId: i.slotId,
  zone: i.mission ? "mission" : i.zone,
  title: i.title,
  min: String(i.min),
  doneText: i.doneText ?? "",
  how: i.how ?? "",
  caution: i.caution ?? "",
  when: i.nth !== null ? "month" : i.days ? "days" : "all",
  days: i.days ? weekSort(i.days) : weekSort(slot?.weekdays ?? [1, 2, 3, 4, 5]),
  nth: i.nth ?? 1,
  nthDow: i.nthDow ?? 3,
  off: i.off,
  months: i.months ?? [],
  active: i.active,
});

const clean = (s: string): string => s.replace(/\s+/g, " ").trim();

/** 서버 ops_clean_item_save 와 같은 검사 · 같은 말 · 같은 순서 */
export const itemDraftError = (d: ItemDraft, slotDays: readonly number[]): string | null => {
  const title = clean(d.title);
  if (!title) return "항목 이름을 적어 주세요";
  if (title.length > 60) return "항목 이름은 60자까지 쓸 수 있어요";
  if (!/^[a-z][a-z0-9_]{1,15}$/.test(d.zone)) return "구역을 골라 주세요";
  if (!/^\d{1,3}$/.test(d.min.trim()) || Number(d.min) > 120) return "목표 분은 0 ~ 120분이에요";
  if (d.doneText.trim().length > 120) return "끝난 상태는 120자까지 쓸 수 있어요";
  if (d.how.trim().length > 300) return "방법은 300자까지 쓸 수 있어요";
  if (d.caution.trim().length > 120) return "주의는 120자까지 쓸 수 있어요";
  if (d.when === "days") {
    if (d.days.length === 0) return "요일을 다시 골라 주세요";
    if (!d.days.some((x) => slotDays.includes(x))) return "이 시간대가 도는 요일 중에서 골라 주세요";
  }
  if (d.when === "month") {
    if (d.nth < 1 || d.nth > 5 || d.nthDow < 0 || d.nthDow > 6 || d.off < -6 || d.off > 6) return "한 달에 한 번 규칙을 다시 골라 주세요";
    if (!slotDays.includes((((d.nthDow + d.off) % 7) + 7) % 7)) return "그날은 이 시간대가 쉬는 요일이에요";
  }
  return null;
};

/** 서버에 보내는 값 */
export const itemDraftPayload = (d: ItemDraft): Record<string, unknown> => ({
  ...(d.id ? { id: d.id } : {}),
  slot_id: d.slotId,
  zone: d.zone,
  title: clean(d.title),
  min: Number(d.min.trim()),
  done_text: d.doneText.trim() || null,
  how: d.how.trim() || null,
  caution: d.caution.trim() || null,
  weekdays: d.when === "days" ? [...d.days].sort((a, b) => a - b) : null,
  months: d.when === "month" && d.months.length > 0 && d.months.length < 12 ? [...d.months].sort((a, b) => a - b) : null,
  month_nth: d.when === "month" ? d.nth : null,
  nth_dow: d.when === "month" ? d.nthDow : null,
  day_offset: d.when === "month" ? d.off : 0,
  active: d.active,
});

export interface SlotDraft {
  id: string;
  label: string;
  time: string;
  budget: string;
  weekdays: number[];
  assignee: string | null;
  alertOn: boolean;
  alertMin: string;
  alertLoud: boolean;
}

export const slotDraftOf = (s: ReportSlot): SlotDraft => ({
  id: s.id,
  label: s.label,
  time: s.time,
  budget: String(s.budget),
  weekdays: weekSort(s.weekdays),
  assignee: s.assignee,
  alertOn: s.alertMin !== null,
  alertMin: String(s.alertMin ?? s.budget),
  alertLoud: s.alertLoud,
});

/** 서버 ops_clean_slot_save 와 같은 검사 · 같은 말 */
export const slotDraftError = (d: SlotDraft): string | null => {
  const label = clean(d.label);
  if (!label || label.length > 12) return "시간대 이름은 1 ~ 12자예요";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.time)) return "시작 시각을 다시 골라 주세요";
  if (!/^\d{1,3}$/.test(d.budget.trim()) || Number(d.budget) < 1 || Number(d.budget) > 240) return "끝낼 때까지 분은 1 ~ 240분이에요";
  if (d.weekdays.length === 0) return "요일을 하나 이상 골라 주세요";
  if (d.alertOn && (!/^\d{1,3}$/.test(d.alertMin.trim()) || Number(d.alertMin) > 240)) return "알림 시각을 다시 골라 주세요";
  return null;
};

export const slotDraftPayload = (d: SlotDraft): Record<string, unknown> => ({
  id: d.id,
  label: clean(d.label),
  time: d.time,
  budget: Number(d.budget.trim()),
  weekdays: [...d.weekdays].sort((a, b) => a - b),
  assignee: d.assignee,
  alert_min: d.alertOn ? Number(d.alertMin.trim()) : null,
  alert_loud: d.alertLoud,
});

/** "11:00" + 50분 → "11:50" (자정 넘으면 다음 날 시각) */
export const addMinutes = (hm: string, min: number): string => {
  const t = (((hmMin(hm) + Math.round(min)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/** "오픈 11:00 · 50분 안에 · 월 ~ 금 · 담당 예시 코치 A · 알림 11:50" */
export const slotSummary = (s: ReportSlot): string => {
  const days = weekSort(s.weekdays);
  const dayText = sameSet(days, [1, 2, 3, 4, 5]) ? "월 ~ 금" : sameSet(days, [0, 1, 2, 3, 4, 5, 6]) ? "매일" : days.map(dowWord).join(" · ");
  const parts = [`${s.budget}분 안에`, dayText, s.assigneeName ? `담당 ${s.assigneeName}` : "담당 그 시간 근무자"];
  parts.push(s.alertMin === null ? "알림 끔" : `알림 ${addMinutes(s.time, s.alertMin)}`);
  return parts.join(" · ");
};
