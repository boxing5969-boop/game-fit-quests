import { describe, expect, it } from "vitest";
import { classifyTicket, computePtMonth, perUseRate, withholding33, type OpsPtEvent, type OpsPtRate } from "./opsPt";

// 예시 수당표 (실제 금액은 DB 에만)
const rates: OpsPtRate[] = [
  { team_size: 1, sessions: 10, session_rate: 30000, valid_from: "2026-01-01" },
  { team_size: 1, sessions: 20, session_rate: 30000, valid_from: "2026-01-01" },
  { team_size: 4, sessions: 10, session_rate: 80000, valid_from: "2026-01-01" },
  { team_size: 4, sessions: 20, session_rate: 70000, valid_from: "2026-01-01" },
  { team_size: 5, sessions: 10, session_rate: 90000, valid_from: "2026-01-01" },
  { team_size: 5, sessions: 20, session_rate: 80000, valid_from: "2026-01-01" },
];

const ev = (over: Partial<OpsPtEvent>): OpsPtEvent => ({
  id: Math.random().toString(36).slice(2),
  member_user_id: "m1",
  member_name: "회원1",
  ticket_name: "퍼스널 트레이닝 20회권",
  before: 10,
  after: 9,
  used: 1,
  kind: "used",
  status: "auto",
  coach_staff_id: "c1",
  work_date: "2026-11-03",
  detected_at: "2026-11-03T01:00:00Z",
  note: null,
  ...over,
});

describe("153운영본부 PT 수당", () => {
  it("수업권 이름으로 1:1 · 팀을 가른다", () => {
    expect(classifyTicket("퍼스널 트레이닝 20회권")).toEqual({ teamSize: 1, sessions: 20 });
    expect(classifyTicket("팀PT 4인 10회")).toEqual({ teamSize: 4, sessions: 10 });
    expect(classifyTicket("5:1 팀 PT 20회권")).toEqual({ teamSize: 5, sessions: 20 });
  });

  it("1:1 은 1회 3만원, 팀은 차감된 팀원 1명당 = 팀 1회 ÷ 정원", () => {
    expect(perUseRate(rates, "퍼스널 트레이닝 10회권", "2026-11-01")).toBe(30000);
    expect(perUseRate(rates, "팀PT 4인 10회", "2026-11-01")).toBe(20000);
    expect(perUseRate(rates, "팀PT 4인 20회", "2026-11-01")).toBe(17500);
    expect(perUseRate(rates, "팀PT 5인 10회", "2026-11-01")).toBe(18000);
    expect(perUseRate(rates, "팀PT 5인 20회", "2026-11-01")).toBe(16000);
  });

  it("팀원 4명이 모두 오면 팀 1회 수당과 같다", () => {
    const team = ["a", "b", "c", "d"].map((m) => ev({ member_user_id: m, member_name: m, ticket_name: "팀PT 4인 10회" }));
    expect(computePtMonth(team, [], rates, "c1").gross).toBe(80000);
  });

  it("확인 전(수업권 끝남) · 뺀 기록은 수당에 넣지 않는다", () => {
    const s = computePtMonth(
      [ev({}), ev({ used: 2, before: 9, after: 7 }), ev({ kind: "ended", status: "check" }), ev({ status: "excluded" })],
      [],
      rates,
      "c1",
    );
    expect(s.uses).toBe(3);
    expect(s.gross).toBe(90000);
    expect(s.toCheck).toHaveLength(1);
  });

  it("다른 코치 기록은 빼고, 코치 화면(수당표 없음)은 금액이 없다", () => {
    const s = computePtMonth([ev({}), ev({ coach_staff_id: "c2" })], [], null, "c1");
    expect(s.uses).toBe(1);
    expect(s.gross).toBeNull();
  });

  it("3.3% — 소득세 3% · 지방소득세 0.3%, 10원 미만 버림", () => {
    expect(withholding33(390000)).toEqual({ income: 11700, local: 1170, total: 12870, net: 377130 });
    expect(withholding33(17500)).toEqual({ income: 520, local: 50, total: 570, net: 16930 });
  });

  it("수당표에 없는 수업권은 따로 센다", () => {
    const s = computePtMonth([ev({ ticket_name: "퍼스널 트레이닝 30회권" })], [], rates, "c1");
    expect(s.unpriced).toBe(1);
    expect(s.gross).toBe(0);
  });
});
