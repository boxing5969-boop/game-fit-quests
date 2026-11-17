import { describe, expect, it } from "vitest";
import {
  addMinutes,
  editSections,
  itemDraftError,
  itemDraftOf,
  itemDraftPayload,
  itemFlag,
  itemStatLine,
  moveInSection,
  newItemDraft,
  normalizeCleanReport,
  openIssues,
  reportCell,
  reportRange,
  reportWeeks,
  ruleText,
  slotDraftError,
  slotDraftOf,
  slotDraftPayload,
  slotItems,
  slotSummary,
  slotWeekMinutes,
  type ReportDay,
  type ReportSlot,
} from "./opsCleanReport";
import { applyReportDemo, buildCleanReportSample } from "./opsCleanReportSample";

const TODAY = "2026-11-17"; // 화요일
const slot: ReportSlot = {
  id: "s-open",
  slot: "open",
  label: "오픈",
  time: "11:00",
  budget: 50,
  weekdays: [1, 2, 3, 4, 5],
  alertMin: 50,
  alertLoud: false,
  assignee: null,
  assigneeName: null,
};
const run = (p: Partial<ReportDay["runs"][number]> = {}) => ({
  slot: "open",
  due: 10,
  done: 0,
  hold: 0,
  issue: 0,
  startedAt: null,
  finishedAt: null,
  note: null,
  finishedByName: null,
  ...p,
});

describe("normalizeCleanReport", () => {
  it("모양이 다르면 꺼진 것으로", () => {
    expect(normalizeCleanReport(null).on).toBe(false);
    expect(normalizeCleanReport({ on: false }).available).toBe(true);
    expect(normalizeCleanReport({ on: true, today: "x" }).on).toBe(false);
  });
  it("서버 모양을 읽는다", () => {
    const r = normalizeCleanReport({
      on: true,
      branch: "153복싱짐 선릉역점",
      branches: [{ branch: "153복싱짐 선릉역점", mine: true }],
      today: TODAY,
      now: "11:30",
      from: "2026-11-10",
      to: TODAY,
      slots: [{ id: "a", slot: "open", label: "오픈", time: "11:00", budget: 50, weekdays: [5, 1, 1, 9], alert_min: null, alert_loud: true, assignee: null }],
      days: [{ date: TODAY, closed: false, runs: [{ slot: "open", due: 3, done: 1, hold: "1", issue: 0 }] }, { date: "bad" }],
      items: [{ id: "i", slot: "open", slot_id: "a", zone: "women", title: " 변기 ", min: 5, weekdays: null, month_nth: 2, nth_dow: 3, day_offset: -1, months: [12, 3], samples: 4, typical: 6.25, active: false }],
      issues: [{ item_id: "i", date: TODAY, slot: "open", title: "변기", note: "막힘", resolved_at: null }],
      staff: [{ id: "u", name: "예시 코치 A" }, { id: "", name: "x" }],
    });
    expect(r.on).toBe(true);
    expect(r.slots[0]).toMatchObject({ weekdays: [1, 5], alertMin: null, alertLoud: true });
    expect(r.days).toHaveLength(1);
    expect(r.days[0].runs[0]).toMatchObject({ due: 3, done: 1, hold: 1 });
    expect(r.items[0]).toMatchObject({ title: "변기", nth: 2, nthDow: 3, off: -1, months: [3, 12], typical: 6.3, active: false });
    expect(openIssues(r)).toHaveLength(1);
    expect(r.staff).toEqual([{ id: "u", name: "예시 코치 A" }]);
  });
});

describe("reportCell · reportWeeks", () => {
  const rep = { today: TODAY, now: "11:30" };
  it("칸 종류", () => {
    expect(reportCell(rep, undefined, slot).kind).toBe("off");
    expect(reportCell(rep, { date: TODAY, closed: true, runs: [] }, slot).kind).toBe("closed");
    expect(reportCell(rep, { date: TODAY, closed: false, runs: [] }, slot).kind).toBe("off");
    expect(reportCell(rep, { date: TODAY, closed: false, runs: [run({ due: 0 })] }, slot).kind).toBe("empty");
    const fin = reportCell(rep, { date: "2026-11-16", closed: false, runs: [run({ startedAt: "2026-11-16T02:00:00Z", finishedAt: "2026-11-16T02:42:20Z", done: 10 })] }, slot);
    expect(fin).toMatchObject({ kind: "finished", minutes: 42 });
    // 오늘 11:30 — 끝낼 시각(11:50) 전
    expect(reportCell(rep, { date: TODAY, closed: false, runs: [run()] }, slot).kind).toBe("wait");
    expect(reportCell(rep, { date: TODAY, closed: false, runs: [run({ done: 2 })] }, slot).kind).toBe("doing");
    expect(reportCell({ today: TODAY, now: "11:50" }, { date: TODAY, closed: false, runs: [run({ done: 2 })] }, slot).kind).toBe("partial");
    expect(reportCell(rep, { date: "2026-11-16", closed: false, runs: [run()] }, slot).kind).toBe("none");
  });
  it("주마다 · 완료율은 끝낼 시각이 지난 칸만", () => {
    const r = normalizeCleanReport({
      on: true,
      today: TODAY,
      now: "11:30",
      from: "2026-11-09",
      to: TODAY,
      slots: [{ id: "s-open", slot: "open", label: "오픈", time: "11:00", budget: 50, weekdays: [1, 2, 3, 4, 5] }],
      days: [
        { date: "2026-11-13", closed: false, runs: [{ slot: "open", due: 10, done: 8, hold: 2, finished_at: "2026-11-13T02:40:00Z", started_at: "2026-11-13T02:00:00Z" }] },
        { date: "2026-11-16", closed: false, runs: [{ slot: "open", due: 10, done: 10, finished_at: "2026-11-16T02:40:00Z", started_at: "2026-11-16T02:00:00Z" }] },
        { date: TODAY, closed: false, runs: [{ slot: "open", due: 10, done: 3 }] },
      ],
    });
    const w = reportWeeks(r);
    expect(w.map((x) => x.label)).toEqual(["이번 주", "지난주"]);
    expect(w[0]).toMatchObject({ rate: 100, finished: 1, counted: 1, dates: ["2026-11-16", TODAY] });
    expect(w[1]).toMatchObject({ rate: 80, finished: 1, counted: 1 });
  });
  it("기간은 월요일부터", () => {
    expect(reportRange(TODAY, 2)).toEqual({ from: "2026-11-09", to: TODAY });
    expect(reportRange("2026-11-16", 4)).toEqual({ from: "2026-10-26", to: "2026-11-16" });
    expect(reportRange("2026-11-22", 1).from).toBe("2026-11-16");
  });
});

describe("항목 걸린 분", () => {
  const base = { min: 5, samples: 4, typical: 5, dueN: 6, holdN: 0, issueN: 0 };
  it("표시", () => {
    expect(itemFlag({ ...base, typical: 8 })).toBe("long");
    expect(itemFlag({ ...base, typical: 6.5 })).toBeNull();
    expect(itemFlag({ ...base, typical: 2.5 })).toBe("short");
    expect(itemFlag({ ...base, samples: 2, typical: 9 })).toBeNull();
    expect(itemFlag({ ...base, holdN: 2 })).toBe("hold");
    expect(itemStatLine({ ...base, typical: 7.5 })).toBe("보통 7.5분 · 목표 5분 · 4번 잼");
    expect(itemStatLine({ ...base, samples: 2, holdN: 1 })).toBe("목표 5분 · 잰 기록 2번 · 보류 1번");
  });
});

describe("고치기", () => {
  const rep = buildCleanReportSample(TODAY, "11:30");
  const open = rep.slots.find((s) => s.slot === "open")!;
  it("예시 = 첫 자료 그대로 · 요일마다 목표 분은 50분 안", () => {
    expect(rep.slots).toHaveLength(3);
    expect(rep.items).toHaveLength(35);
    const week = slotWeekMinutes(open, rep.items, "2026-11-02");
    expect(week.map((w) => w.dow)).toEqual([1, 2, 3, 4, 5]);
    expect(week[0]).toEqual({ dow: 1, min: 40, max: 40 });
    expect(week[1]).toEqual({ dow: 2, min: 42, max: 50 });
    expect(week.every((w) => w.max <= 50)).toBe(true);
  });
  it("동선 묶음 · 같은 묶음 안에서만 옮기기", () => {
    const items = slotItems(rep, open.id);
    const secs = editSections(items);
    expect(secs[0].zone).toBe("start");
    expect(secs.map((s) => s.zone)).toContain("mission");
    const women = secs.find((s) => s.zone === "women")!;
    const ids = moveInSection(items, women.items[1].id, -1)!;
    expect(ids.indexOf(women.items[1].id)).toBeLessThan(ids.indexOf(women.items[0].id));
    expect(moveInSection(items, women.items[0].id, -1)).toBeNull();
  });
  it("규칙 글", () => {
    expect(ruleText({ days: null, nth: null, nthDow: null, off: 0, months: null }, [1, 2, 3, 4, 5])).toBe("매일");
    expect(ruleText({ days: [5, 1, 3], nth: null, nthDow: null, off: 0, months: null }, [1, 2, 3, 4, 5])).toBe("월 · 수 · 금");
    expect(ruleText({ days: null, nth: 1, nthDow: 3, off: -1, months: [3, 6, 9, 12] }, [1, 2, 3, 4, 5])).toBe("첫째 수요일 전날 · 3 · 6 · 9 · 12월");
  });
  it("항목 검사 말 = 서버", () => {
    const d = newItemDraft(open, "women");
    const cases: [Partial<typeof d>, string | null][] = [
      [{ title: "  " }, "항목 이름을 적어 주세요"],
      [{ title: "가".repeat(61) }, "항목 이름은 60자까지 쓸 수 있어요"],
      [{ title: "a", zone: "Women" }, "구역을 골라 주세요"],
      [{ title: "a", min: "121" }, "목표 분은 0 ~ 120분이에요"],
      [{ title: "a", min: "x" }, "목표 분은 0 ~ 120분이에요"],
      [{ title: "a", doneText: "가".repeat(121) }, "끝난 상태는 120자까지 쓸 수 있어요"],
      [{ title: "a", how: "가".repeat(301) }, "방법은 300자까지 쓸 수 있어요"],
      [{ title: "a", caution: "가".repeat(121) }, "주의는 120자까지 쓸 수 있어요"],
      [{ title: "a", when: "days", days: [] }, "요일을 다시 골라 주세요"],
      [{ title: "a", when: "days", days: [6] }, "이 시간대가 도는 요일 중에서 골라 주세요"],
      [{ title: "a", when: "month", nth: 1, nthDow: 1, off: -1 }, "그날은 이 시간대가 쉬는 요일이에요"],
      [{ title: "a", when: "month", nth: 6 }, "한 달에 한 번 규칙을 다시 골라 주세요"],
      [{ title: "거울 닦기", when: "month", nth: 2, nthDow: 3, off: 0, months: [3, 6] }, null],
    ];
    for (const [patch, want] of cases) expect(itemDraftError({ ...d, ...patch }, open.weekdays)).toBe(want);
    const p = itemDraftPayload({ ...d, title: " 거울   닦기 ", when: "month", nth: 2, nthDow: 3, months: [6, 3], min: " 3 " });
    expect(p).toMatchObject({ slot_id: open.id, title: "거울 닦기", min: 3, weekdays: null, months: [3, 6], month_nth: 2, nth_dow: 3, day_offset: 0, active: true });
    expect(p).not.toHaveProperty("id");
    const back = itemDraftOf(rep.items.find((i) => i.mission)!, open);
    expect(back.zone).toBe("mission");
  });
  it("시간대 검사 · 글", () => {
    const d = slotDraftOf(open);
    expect(slotDraftError({ ...d, label: "열세글자는너무길어서안돼요" })).toBe("시간대 이름은 1 ~ 12자예요");
    expect(slotDraftError({ ...d, time: "25:00" })).toBe("시작 시각을 다시 골라 주세요");
    expect(slotDraftError({ ...d, budget: "0" })).toBe("끝낼 때까지 분은 1 ~ 240분이에요");
    expect(slotDraftError({ ...d, weekdays: [] })).toBe("요일을 하나 이상 골라 주세요");
    expect(slotDraftError({ ...d, alertMin: "300" })).toBe("알림 시각을 다시 골라 주세요");
    expect(slotDraftError({ ...d, alertOn: false, alertMin: "300" })).toBeNull();
    expect(slotDraftPayload({ ...d, alertOn: false })).toMatchObject({ alert_min: null, weekdays: [1, 2, 3, 4, 5] });
    expect(slotSummary(open)).toBe("50분 안에 · 월 ~ 금 · 담당 예시 코치 A · 알림 11:50");
    expect(addMinutes("22:50", 10)).toBe("23:00");
    expect(addMinutes("23:50", 20)).toBe("00:10");
  });
  it("예시 고치기 = 서버 규칙", () => {
    const now = "2026-11-17T03:00:00Z";
    const r1 = applyReportDemo(rep, { type: "item", payload: { slot_id: open.id, zone: "women", title: "거울 닦기", min: 3, active: true } }, now);
    const items = slotItems(r1, open.id);
    const k = items.findIndex((i) => i.title === "거울 닦기");
    expect(items[k - 1].zone).toBe("women");
    expect(items[k + 1].zone).not.toBe("women");
    const iss = openIssues(rep)[0];
    const r2 = applyReportDemo(rep, { type: "resolve", itemId: iss.itemId, date: iss.date, note: "고쳤어요" }, now);
    expect(openIssues(r2)).toHaveLength(openIssues(rep).length - 1);
    const r3 = applyReportDemo(rep, { type: "slot", payload: { ...slotDraftPayload(slotDraftOf(open)), assignee: "demo-b", alert_min: null } }, now);
    expect(r3.slots[0]).toMatchObject({ assigneeName: "예시 코치 B", alertMin: null });
    const ids = slotItems(rep, open.id).map((i) => i.id).reverse();
    const r4 = applyReportDemo(rep, { type: "order", slotId: open.id, ids }, now);
    expect(slotItems(r4, open.id).map((i) => i.id)).toEqual(ids);
  });
});
