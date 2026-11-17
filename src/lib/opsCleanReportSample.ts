/**
 * 「오늘 청소」 2단계 현황 · 고치기 예시 (/office?cleandemo=manager) — 서버를 부르지 않는다 · 지어낸 이름 · 저장 안 됨
 *   첫 자료(CLEAN_SEED_*) 로 최근 4주 기록을 지어낸다(날짜 · 시간대로 정해지는 값이라 열 때마다 같다).
 *   applyReportDemo = 서버 ops_clean_issue_resolve · ops_clean_item_save · ops_clean_items_order · ops_clean_slot_save 와 같은 규칙
 */
import { cleanDue, shiftCleanDay } from "./opsClean";
import { CLEAN_SEED_BRANCH, CLEAN_SEED_ITEMS, CLEAN_SEED_SLOTS } from "./opsCleanSample";
import { reportRange, ruleOf, type CleanReport, type ReportDay, type ReportIssue, type ReportItem, type ReportRun, type ReportSlot } from "./opsCleanReport";

const STAFF = [
  { id: "demo-a", name: "예시 코치 A" },
  { id: "demo-b", name: "예시 코치 B" },
  { id: "demo-c", name: "예시 코치 C" },
];
const MANAGER = "예시 지점장";

const hash = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const hmMin = (hm: string): number => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5));
const at = (date: string, minOfDay: number): string => new Date(Date.parse(`${date}T00:00:00+09:00`) + minOfDay * 60_000).toISOString();
const dowOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/** 보통 걸린 분 — 몇 항목은 목표보다 오래 · 빨리 걸린 것처럼 (목표 분에 더하는 분) */
const TYPICAL_SHIFT: Record<string, number> = { women_shower: 3, men_shower: 2.5, finish: 2.5, ring: -2 };

export const buildCleanReportSample = (today: string, nowHm: string): CleanReport => {
  const slots: ReportSlot[] = CLEAN_SEED_SLOTS.map((s) => ({
    id: `demo-slot-${s.slot}`,
    slot: s.slot,
    label: s.label,
    time: s.time,
    budget: s.budget,
    weekdays: [...s.days],
    alertMin: s.slot === "evening" ? null : s.budget,
    alertLoud: false,
    assignee: s.slot === "open" ? "demo-a" : s.slot === "close" ? "demo-c" : null,
    assigneeName: s.slot === "open" ? "예시 코치 A" : s.slot === "close" ? "예시 코치 C" : null,
  }));
  const items: ReportItem[] = CLEAN_SEED_ITEMS.map((i) => ({
    id: `demo-${i.slot}-${i.code}`,
    slot: i.slot,
    slotId: `demo-slot-${i.slot}`,
    zone: i.zone,
    title: i.title,
    min: i.min,
    doneText: i.done,
    how: i.how,
    caution: i.caution,
    mission: i.mission,
    days: i.days ? [...i.days] : null,
    nth: i.nth ?? null,
    nthDow: i.nthDow ?? null,
    off: i.off ?? 0,
    months: i.months ? [...i.months] : null,
    sort: i.sort,
    active: true,
    dueN: 0,
    doneN: 0,
    holdN: 0,
    issueN: 0,
    samples: 0,
    typical: null,
  }));
  const byId = new Map(items.map((i) => [i.id, i]));
  const { from } = reportRange(today, 4);
  const nowMin = hmMin(nowHm);
  const days: ReportDay[] = [];
  const issueDays = new Set<string>();
  for (let date = from; date <= today; date = shiftCleanDay(date, 1)) {
    const dow = dowOf(date);
    if (!slots.some((s) => s.weekdays.includes(dow))) continue;
    const runs: ReportRun[] = [];
    for (const s of slots) {
      if (!s.weekdays.includes(dow)) continue;
      const due = items.filter((i) => i.slotId === s.id && cleanDue(date, s.weekdays, ruleOf(i)));
      const h = hash(`${date}|${s.slot}`);
      const start = hmMin(s.time);
      const isToday = date === today;
      // 오늘은 지금 시각에 맞춰: 시작 전 · 진행 중 · 끝
      const phase = !isToday ? "past" : nowMin < start ? "wait" : nowMin < start + s.budget ? "doing" : "past";
      const partial = phase === "past" && !isToday && h % 11 === 0;
      const hold = phase === "past" && due.length > 3 && h % 5 === 0 ? 1 : 0;
      const doneTarget =
        phase === "wait" ? 0 : phase === "doing" ? Math.min(due.length, Math.floor(((nowMin - start) / s.budget) * due.length)) : partial ? Math.max(0, due.length - 2) : due.length - hold;
      let done = 0;
      let holdN = 0;
      due.forEach((i, k) => {
        if (phase === "past") i.dueN += 1;
        if (k < doneTarget) {
          done += 1;
          if (phase === "past") i.doneN += 1;
        } else if (phase === "past" && !partial && holdN < hold) {
          holdN += 1;
          i.holdN += 1;
        }
      });
      const minutes = s.budget - 8 + (h % 12);
      runs.push({
        slot: s.slot,
        due: due.length,
        done,
        hold: holdN,
        issue: 0,
        startedAt: phase === "wait" ? null : at(date, start + (h % 4)),
        finishedAt: phase === "past" && !partial ? at(date, start + (h % 4) + minutes) : null,
        note: null,
        finishedByName: phase === "past" && !partial ? (s.slot === "open" ? "예시 코치 A" : s.slot === "evening" ? "예시 코치 B" : "예시 코치 C") : null,
      });
    }
    days.push({ date, closed: false, runs });
  }
  // 보통 걸린 분 — 오픈 항목만(저녁 · 마감은 짧아 잴 일이 드물다)
  for (const i of items) {
    if (i.slot !== "open" || i.doneN === 0) continue;
    i.samples = Math.max(0, i.doneN - (hash(i.id) % 3));
    const base = i.min * (0.9 + (hash(i.id) % 3) * 0.1) + (TYPICAL_SHIFT[i.id.replace("demo-open-", "")] ?? 0);
    i.typical = i.samples > 0 ? Math.max(0.5, Math.round(base * 2) / 2) : null;
  }
  // 문제 — 처리 안 한 것 둘 · 처리한 것 하나
  const pastDays = days.filter((d) => d.date < today).map((d) => d.date);
  const issue = (code: string, back: number, note: string, resolved: string | null): ReportIssue | null => {
    const date = pastDays[pastDays.length - back];
    const item = byId.get(`demo-open-${code}`);
    if (!date || !item) return null;
    const run = days.find((d) => d.date === date)?.runs.find((r) => r.slot === "open");
    if (run && run.done > 0 && !issueDays.has(date + code)) {
      run.done -= 1;
      run.issue += 1;
      item.doneN = Math.max(0, item.doneN - 1);
      item.issueN += 1;
      issueDays.add(date + code);
    }
    return {
      itemId: item.id,
      date,
      slot: "open",
      label: "오픈",
      title: item.title,
      note,
      byName: "예시 코치 A",
      at: at(date, 11 * 60 + 20),
      resolvedAt: resolved ? at(date, 15 * 60) : null,
      resolvedByName: resolved ? MANAGER : null,
      resolveNote: resolved,
    };
  };
  const issues = [
    issue("men_toilet", 1, "배수구가 막혀서 물이 잘 안 내려가요", null),
    issue("ring", 2, "링 바닥 테이프가 뜯어졌어요", null),
    issue("women_locker", 4, "락카 열쇠 하나가 안 돌아가요", "열쇠 새로 맞췄어요"),
  ].filter((x): x is ReportIssue => !!x);
  return {
    available: true,
    on: true,
    branch: CLEAN_SEED_BRANCH,
    branches: [{ branch: CLEAN_SEED_BRANCH, mine: true }],
    today,
    now: nowHm,
    from,
    to: today,
    slots,
    days,
    items,
    issues,
    staff: STAFF,
  };
};

export type ReportDemoAction =
  | { type: "resolve"; itemId: string; date: string; note: string | null }
  | { type: "item"; payload: Record<string, unknown> }
  | { type: "order"; slotId: string; ids: string[] }
  | { type: "slot"; payload: Record<string, unknown> };

const arrOrNull = (v: unknown): number[] | null => (Array.isArray(v) && v.length > 0 ? (v as number[]).slice() : null);

/** 같은 시간대 넣은 항목을 순서대로 1, 2, 3 … (뺀 항목은 그대로) */
const renumber = (items: ReportItem[], slotId: string, order: string[]): ReportItem[] => {
  const pos = new Map(order.map((id, k) => [id, k + 1]));
  return items.map((i) => (i.slotId === slotId && pos.has(i.id) ? { ...i, sort: pos.get(i.id)! } : i));
};

const sortItems = (rep: CleanReport, items: ReportItem[]): ReportItem[] => {
  const slotPos = new Map(rep.slots.map((s, k) => [s.id, k]));
  return [...items].sort((a, b) => (slotPos.get(a.slotId) ?? 0) - (slotPos.get(b.slotId) ?? 0) || a.sort - b.sort || (a.id < b.id ? -1 : 1));
};

export const applyReportDemo = (rep: CleanReport, a: ReportDemoAction, nowIso: string): CleanReport => {
  if (a.type === "resolve") {
    return {
      ...rep,
      issues: rep.issues.map((i) =>
        i.itemId === a.itemId && i.date === a.date ? { ...i, resolvedAt: i.resolvedAt ?? nowIso, resolvedByName: i.resolvedByName ?? MANAGER, resolveNote: a.note } : i,
      ),
    };
  }
  if (a.type === "order") return { ...rep, items: sortItems(rep, renumber(rep.items, a.slotId, a.ids)) };
  if (a.type === "slot") {
    const p = a.payload;
    return {
      ...rep,
      slots: rep.slots.map((s) =>
        s.id !== p.id
          ? s
          : {
              ...s,
              label: String(p.label ?? s.label),
              time: String(p.time ?? s.time),
              budget: Number(p.budget ?? s.budget),
              weekdays: arrOrNull(p.weekdays) ?? s.weekdays,
              assignee: (p.assignee as string | null) ?? null,
              assigneeName: rep.staff.find((x) => x.id === p.assignee)?.name ?? null,
              alertMin: p.alert_min === null || p.alert_min === undefined ? null : Number(p.alert_min),
              alertLoud: p.alert_loud === true,
            },
      ),
    };
  }
  // 항목 — 서버처럼: 새 항목 · 구역이나 시간대를 바꾼 항목 · 다시 넣은 항목은 그 구역 맨 뒤로
  const p = a.payload;
  const id = typeof p.id === "string" ? p.id : `demo-new-${hash(nowIso + String(p.title))}`;
  const old = rep.items.find((i) => i.id === id);
  const slot = rep.slots.find((s) => s.id === p.slot_id) ?? rep.slots.find((s) => s.id === old?.slotId);
  if (!slot) return rep;
  const zone = String(p.zone);
  const next: ReportItem = {
    ...(old ?? { dueN: 0, doneN: 0, holdN: 0, issueN: 0, samples: 0, typical: null, sort: 0 }),
    id,
    slot: slot.slot,
    slotId: slot.id,
    zone,
    mission: zone === "mission",
    title: String(p.title),
    min: Number(p.min),
    doneText: (p.done_text as string | null) ?? null,
    how: (p.how as string | null) ?? null,
    caution: (p.caution as string | null) ?? null,
    days: arrOrNull(p.weekdays),
    nth: (p.month_nth as number | null) ?? null,
    nthDow: (p.nth_dow as number | null) ?? null,
    off: Number(p.day_offset ?? 0),
    months: arrOrNull(p.months),
    active: p.active !== false,
  };
  const move = next.active && (!old || old.zone !== zone || old.slotId !== slot.id || !old.active);
  let items = old ? rep.items.map((i) => (i.id === id ? next : i)) : [...rep.items, next];
  if (move) {
    const ordered = sortItems(rep, items).filter((i) => i.slotId === slot.id && i.active && i.id !== id);
    const lastInZone = ordered.map((i) => i.zone).lastIndexOf(zone);
    const order = ordered.map((i) => i.id);
    order.splice(lastInZone >= 0 ? lastInZone + 1 : order.length, 0, id);
    items = renumber(items, slot.id, order);
  }
  return { ...rep, items: sortItems(rep, items) };
};
