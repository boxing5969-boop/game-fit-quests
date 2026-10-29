import { describe, expect, it } from "vitest";
import {
  computeDay,
  computeStaffMonth,
  laborNotices,
  minWageOn,
  scheduleSummary,
  weeklyScheduledMin,
  type OpsCheckin,
  type OpsEntry,
  type OpsRule,
  type OpsStaff,
} from "./opsWork";

const staff = (over: Partial<OpsStaff> = {}): OpsStaff => ({
  id: "a",
  user_id: "u-a",
  name: "코치A",
  kind: "parttime",
  pay_type: "hourly",
  hourly_wage: 15000,
  monthly_salary: null,
  pt_freelancer: false,
  checkin_required: true,
  start_date: null,
  end_date: null,
  active: true,
  ...over,
});

// 월 · 수 · 금 06:00~08:00 (2시간)
const rules: OpsRule[] = [1, 3, 5].map((wd) => ({
  id: `r${wd}`,
  staff_id: "a",
  weekday: wd,
  start_time: "06:00",
  end_time: "08:00",
  valid_from: "2026-10-01",
  valid_to: null,
}));

const entry = (over: Partial<OpsEntry>): OpsEntry => ({
  id: Math.random().toString(36).slice(2),
  staff_id: "a",
  work_date: "2026-11-02",
  kind: "adjust",
  status: "approved",
  minutes: null,
  start_time: null,
  end_time: null,
  cover_staff_id: null,
  reason: null,
  ...over,
});

const ctx = (over: { entries?: OpsEntry[]; checkins?: OpsCheckin[]; today?: string; rules?: OpsRule[]; staff?: OpsStaff[] } = {}) => {
  const list = over.staff ?? [staff(), staff({ id: "b", user_id: "u-b", name: "코치B" })];
  return {
    rules: over.rules ?? rules,
    entries: over.entries ?? [],
    checkins: over.checkins ?? [],
    staffById: new Map(list.map((s) => [s.id, s])),
    today: over.today ?? "2026-11-30",
  };
};

describe("153운영본부 근무 계산", () => {
  it("얼굴 출근이 있으면 시간표대로 인정 (퇴근은 자동)", () => {
    const d = computeDay(staff(), "2026-11-02", ctx({ checkins: [{ staff_id: "a", work_date: "2026-11-02", at_hm: "05:55" }] }));
    expect(d.status).toBe("ok");
    expect(d.creditedMin).toBe(120);
  });

  it("출근을 안 찍으면 0시간 · 누락", () => {
    const d = computeDay(staff(), "2026-11-02", ctx());
    expect(d.status).toBe("missing");
    expect(d.creditedMin).toBe(0);
  });

  it("늦게 찍으면 지각 표시만 하고 인정은 그대로(고치는 건 지점장)", () => {
    const d = computeDay(staff(), "2026-11-02", ctx({ checkins: [{ staff_id: "a", work_date: "2026-11-02", at_hm: "06:25" }] }));
    expect(d.status).toBe("late");
    expect(d.creditedMin).toBe(120);
  });

  it("지점장이 고친 시간이 우선", () => {
    const d = computeDay(
      staff(),
      "2026-11-02",
      ctx({ entries: [entry({ minutes: 60 })], checkins: [{ staff_id: "a", work_date: "2026-11-02", at_hm: "07:00" }] }),
    );
    expect(d.status).toBe("adjusted");
    expect(d.creditedMin).toBe(60);
  });

  it("얼굴 출근 단말이 없는 지점(출근 확인 끔)은 시간표대로", () => {
    const d = computeDay(staff({ checkin_required: false }), "2026-11-02", ctx());
    expect(d.status).toBe("ok");
    expect(d.creditedMin).toBe(120);
  });

  it("승인된 연장 근무만 더한다", () => {
    const c = ctx({
      checkins: [{ staff_id: "a", work_date: "2026-11-02", at_hm: "06:00" }],
      entries: [entry({ kind: "overtime", minutes: 30 }), entry({ kind: "overtime", minutes: 60, status: "pending" })],
    });
    const d = computeDay(staff(), "2026-11-02", c);
    expect(d.creditedMin).toBe(150);
    expect(d.pending).toHaveLength(1);
  });

  it("수업 대타 — 원래 코치는 빠지고 대타 코치에게 붙는다(대타 코치도 출근 기록 필요)", () => {
    const cover = entry({ kind: "cover", start_time: "06:00", end_time: "08:00", cover_staff_id: "b", minutes: 120 });
    const c = ctx({ entries: [cover], checkins: [{ staff_id: "b", work_date: "2026-11-02", at_hm: "05:58" }] });
    const a = computeDay(staff(), "2026-11-02", c);
    const b = computeDay(staff({ id: "b", user_id: "u-b", name: "코치B" }), "2026-11-02", c);
    expect(a.scheduledMin).toBe(0);
    expect(a.creditedMin).toBe(0);
    expect(b.creditedMin).toBe(120);
    expect(b.segs[0].coverFor).toBe("코치A");
  });

  it("쉰 날은 0시간 · 쉼", () => {
    const d = computeDay(staff(), "2026-11-02", ctx({ entries: [entry({ kind: "off", minutes: 0 })] }));
    expect(d.status).toBe("off");
    expect(d.creditedMin).toBe(0);
  });

  it("근무 기간 밖은 시간표가 없다 (마지막 근무일 11월 30일)", () => {
    expect(computeDay(staff({ end_date: "2026-11-30" }), "2026-12-02", ctx({ today: "2026-12-31" })).scheduledMin).toBe(0);
  });

  it("한 달 합계 · 기본급 = 시간 × 시급", () => {
    // 2026년 11월 월·수·금 = 13일, 모두 출근
    const days = ["02", "04", "06", "09", "11", "13", "16", "18", "20", "23", "25", "27", "30"];
    const c = ctx({ checkins: days.map((d) => ({ staff_id: "a", work_date: `2026-11-${d}`, at_hm: "06:00" })) });
    const m = computeStaffMonth(staff(), "2026-11-01", c);
    expect(m.workDays).toBe(13);
    expect(m.creditedMin).toBe(13 * 120);
    expect(m.basePay).toBe(13 * 2 * 15000);
    expect(m.missing).toBe(0);
  });

  it("주 시간 · 주휴/4대보험 안내", () => {
    expect(weeklyScheduledMin(staff(), rules, "2026-11-02")).toBe(360);
    expect(laborNotices(staff(), 360, 1560)).toEqual([]);
    expect(laborNotices(staff(), 20 * 60, 80 * 60)).toEqual(["주 15시간 이상 — 주휴수당 대상", "월 60시간 이상 — 4대보험 가입 대상"]);
    expect(laborNotices(staff({ kind: "freelancer" }), 20 * 60, 80 * 60)).toEqual([]);
  });

  it("시간표 요약은 같은 시간끼리 요일을 묶는다", () => {
    expect(scheduleSummary(staff(), rules, "2026-11-02")).toBe("월·수·금 06:00~08:00");
  });

  it("최저시급 — 2027년 1월 1일부터 10,700원", () => {
    expect(minWageOn("2026-12-31")).toBe(10320);
    expect(minWageOn("2027-01-01")).toBe(10700);
  });
});
