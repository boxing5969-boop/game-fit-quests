import { describe, expect, it } from "vitest";
import {
  LEADER_DEMO,
  LEADER_OFF,
  canUndo,
  contactLine,
  expiringSay,
  kpiView,
  needMore,
  normalizeLeaderHome,
  photoCoverage,
  sortExpiring,
  sortStarters,
  starterChips,
  starterRx,
  type ExpiringRow,
  type StarterRow,
} from "./leaderHome";

const base = {
  realName: null,
  avatarUrl: null,
  photoPath: null,
  firstDay: null,
  lastDay: null,
  total: 0,
  cameAt: null,
  end: null,
  contact: null,
};

describe("normalizeLeaderHome", () => {
  it("꺼짐 · 회원은 LEADER_OFF", () => {
    expect(normalizeLeaderHome(null)).toEqual(LEADER_OFF);
    expect(normalizeLeaderHome({ on: false, role: "none" }).on).toBe(false);
    expect(normalizeLeaderHome({ on: false, role: "coach", branch: "153복싱짐 칠금점" })).toMatchObject({ on: false, role: "coach" });
  });

  it("서버 JSON 을 읽는다 — 줄 · 숫자 · 기록 · 재등록률", () => {
    const d = LEADER_DEMO;
    expect(d.on).toBe(true);
    expect(d.role).toBe("coach");
    expect(d.expiring).toHaveLength(3);
    expect(d.expiring[0]).toMatchObject({ userId: "demo-1", daysLeft: 2, here: true, firstTerm: true });
    expect(d.expiring[1].contact).toMatchObject({ kind: "talk", by: "박성현", mine: false });
    expect(d.winback[0]).toMatchObject({ daysSince: 3 });
    expect(d.starters[0].reasons).toEqual(["first"]);
    expect(d.counts).toMatchObject({ expiring: 24, expiringFirst: 15, risk: 12, here: 7 });
    expect(d.kpi).toMatchObject({ rate: 24, n: 129, renewed30: 31 });
    expect(d.kpi?.next).toMatchObject({ month: "2026-12", n: 22, renewed: 1 });
  });

  it("모르는 값은 버린다", () => {
    const d = normalizeLeaderHome({
      on: true,
      role: "weird",
      starters: [{ user_id: "a", reasons: ["first", "hack", 3] }, { name: "no id" }],
      expiring: [{ user_id: "b", contact: { id: "x", kind: "call" } }],
    });
    expect(d.role).toBe("coach");
    expect(d.starters).toHaveLength(1);
    expect(d.starters[0].reasons).toEqual(["first"]);
    expect(d.expiring[0].contact).toBeNull();
  });
});

describe("순서", () => {
  const row = (o: Partial<ExpiringRow>): ExpiringRow => ({
    userId: "x",
    name: "가",
    firstTerm: false,
    v14: 1,
    here: false,
    daysLeft: 5,
    ...base,
    ...o,
  });
  it("기간 임박 — 지금 체육관 → 첫 수강권 → 가까운 날", () => {
    const out = sortExpiring([
      row({ userId: "a", daysLeft: 1 }),
      row({ userId: "b", daysLeft: 9, firstTerm: true }),
      row({ userId: "c", daysLeft: 12, here: true }),
      row({ userId: "d", daysLeft: 3, firstTerm: true }),
    ]);
    expect(out.map((r) => r.userId)).toEqual(["c", "d", "b", "a"]);
  });

  const st = (o: Partial<StarterRow>): StarterRow => ({
    userId: "x",
    name: "가",
    firstTerm: null,
    v14: 1,
    here: false,
    day: 10,
    count: 2,
    expected: 2,
    goal: 8,
    gap: 1,
    done8: false,
    reasons: ["behind"],
    ...base,
    ...o,
  });
  it("재미 위험 신규 — 지금 체육관 → 첫 출석 → 많이 늦은 순", () => {
    const out = sortStarters([
      st({ userId: "a", count: 1, expected: 4 }),
      st({ userId: "b", reasons: ["first"], count: 1, expected: 0 }),
      st({ userId: "c", here: true }),
      st({ userId: "d", reasons: ["gap"], gap: 12, count: 3, expected: 3 }),
    ]);
    expect(out.map((r) => r.userId)).toEqual(["c", "b", "a", "d"]);
  });

  it("처방 하나 · 칩", () => {
    expect(starterRx(st({ reasons: ["first"] })).key).toBe("jab");
    expect(starterRx(st({ reasons: ["behind", "gap"], gap: 9 })).key).toBe("note");
    expect(starterRx(st({ reasons: ["behind"], count: 1 })).key).toBe("name");
    expect(starterRx(st({ reasons: ["behind"], count: 3 })).key).toBe("promise");
    expect(starterRx(st({ reasons: ["slow"], v14: 1 })).key).toBe("partner");
    expect(starterRx(st({ reasons: ["slow"], v14: 3 })).key).toBe("level");
    expect(starterChips(st({ reasons: ["behind", "gap"], day: 19, gap: 9 }))).toEqual(["19일째", "9일 안 옴", "주 2번보다 늦음"]);
    expect(starterChips(st({ reasons: ["first"] }))).toEqual(["오늘 첫 출석"]);
  });
});

describe("글", () => {
  it("목표까지 몇 명 더", () => {
    expect(needMore(22, 1, 70)).toBe(15);
    expect(needMore(14, 2, 70)).toBe(8);
    expect(needMore(10, 7, 70)).toBe(0);
    expect(needMore(0, 0, 70)).toBe(0);
  });

  it("재등록률 칸 글", () => {
    const v = kpiView(LEADER_DEMO.kpi, 70);
    expect(v.rateText).toBe("24%");
    expect(v.lines).toEqual([
      "11월에 첫 수강권 끝나는 신규 14명 · 지금 2명 재등록 · 70%까지 8명 더",
      "12월에 첫 수강권 끝나는 신규 22명 · 지금 1명 재등록 · 70%까지 15명 더",
    ]);
    expect(v.note).toContain("추정");
    expect(kpiView(null, 70).rateText).toBe("계산 중");
  });

  it("할 말 · 기록 줄 · 되돌리기", () => {
    const e = (o: Partial<ExpiringRow>): ExpiringRow => ({ userId: "x", name: "가", firstTerm: false, v14: 2, here: false, daysLeft: 3, ...base, ...o });
    expect(expiringSay(e({ v14: 0 }))).toContain("요즘 못 뵀어요");
    expect(expiringSay(e({ firstTerm: true }))).toContain("처음보다");
    const c = { id: "1", kind: "rx" as const, topic: "starter" as const, rx: "jab" as const, at: "2026-11-26T01:00:00Z", by: "박성현", mine: true };
    expect(contactLine(c, "2026-11-26")).toBe("내가 · 오늘 처방함(잽 미트)");
    expect(contactLine({ ...c, kind: "talk", rx: null, mine: false, at: "2026-11-25T01:00:00Z" }, "2026-11-26")).toBe("박성현 코치 · 11/25 이야기함");
    expect(canUndo(c, Date.parse("2026-11-26T05:00:00Z"))).toBe(true);
    expect(canUndo(c, Date.parse("2026-11-28T05:00:00Z"))).toBe(false);
    expect(canUndo({ ...c, mine: false }, Date.parse("2026-11-26T05:00:00Z"))).toBe(false);
  });

  it("얼굴 보이는 회원 비율", () => {
    expect(photoCoverage(LEADER_DEMO.counts).pct).toBe(13);
  });
});
