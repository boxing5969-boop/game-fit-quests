import { describe, expect, it } from "vitest";
import {
  OWNER_DEMO,
  OWNER_OFF,
  kstStamp,
  normalizeOwnerHome,
  ownerStamp,
  ownerTileHelp,
  ownerTiles,
  ownerTodos,
  wonShort,
} from "./ownerKpi";

const raw = (over: Record<string, unknown> = {}) => ({
  on: true,
  role: "manager",
  branch: "153복싱짐 선릉역점",
  today: "2026-11-26",
  sales_visible: false,
  conf: { attendance_target: 80 },
  owner: {
    members: { active: 133, active_all: 138, holding: 5, new_month: 25, ended_month: 24 },
    attendance: { from: "2026-11-20", to: "2026-11-26", n: 94, base: 133, rate: 70.7, prev_n: 95, prev_rate: 71.4, week_avg: 1.6 },
    sales: { month: "2026-11", mtd: 1000, prev_month: "2026-10", prev_same: 900, prev_full: 2000 },
    todo: { expiring_14d: 21, no_visit_7d: 26, leads_overdue: 1, leads_month: 3 },
    sync: { snap_at: "2026-11-26T14:20:23Z" },
  },
  owner_at: "2026-11-26T14:47:19Z",
  owner_stale: false,
  renew: null,
  renew_stale: true,
  month_ago: null,
  ...over,
});

describe("normalizeOwnerHome", () => {
  it("꺼짐 — 코치 · 회원 · 꺼진 지점", () => {
    expect(normalizeOwnerHome({ on: false, role: "none" })).toEqual(OWNER_OFF);
    expect(normalizeOwnerHome(null)).toEqual(OWNER_OFF);
    expect(normalizeOwnerHome({ on: false, role: "manager", branch: "x" })).toMatchObject({ on: false, role: "manager", branch: "x" });
  });

  it("지점장 — 매출 권한이 없으면 서버가 보낸 매출도 버린다", () => {
    const d = normalizeOwnerHome(raw());
    expect(d).toMatchObject({ on: true, role: "manager", salesVisible: false, attendanceTarget: 80, renew: null, renewStale: true });
    expect(d.owner?.sales).toBeNull();
    expect(d.owner?.members).toEqual({ active: 133, activeAll: 138, holding: 5, newMonth: 25, endedMonth: 24 });
    expect(d.owner?.todo).toEqual({ expiring14: 21, noVisit7: 26, leadsOverdue: 1, leadsMonth: 3 });
  });
});

describe("ownerTiles — 네 칸", () => {
  it("본사 예시(11/26 선릉 숫자) — 재등록률 · 출석률 · 유효 회원 · 매출", () => {
    const tiles = ownerTiles(OWNER_DEMO);
    expect(tiles.map((t) => t.key)).toEqual(["renew", "attendance", "active", "sales"]);
    const [renew, att, active, sales] = tiles;
    expect(renew).toMatchObject({ value: "33%", sub: "10월 46명 중 15명", note: "추정 · 12/1 확정" });
    expect(renew.delta).toEqual({ text: "9월보다 −5%p", tone: "down" });
    expect(att).toMatchObject({ value: "71%", sub: "최근 7일 94/133명 · 목표 80%", note: "주 평균 1.6회" });
    expect(att.delta).toEqual({ text: "지난주보다 −1%p", tone: "down" });
    expect(active).toMatchObject({ value: "133명", sub: "홀딩 5명 따로", delta: null, note: "새로 25 · 끝남 24" });
    expect(sales).toMatchObject({ value: "1,967만", sub: "11/25까지 · 환불 뺌", note: "10월 한 달 2,545만" });
    expect(sales.delta).toEqual({ text: "10월 같은 날보다 +14만", tone: "up" });
  });

  it("지점장(매출 권한 없음) — 세 칸 · 재등록률이 아직 없으면 계산 중", () => {
    const tiles = ownerTiles(normalizeOwnerHome(raw()));
    expect(tiles.map((t) => t.key)).toEqual(["renew", "attendance", "active"]);
    expect(tiles[0]).toMatchObject({ value: "—", sub: "계산하는 중이에요" });
  });

  it("지난달 같은 날 기록이 생기면 지난달과 비교한다", () => {
    const d = normalizeOwnerHome(raw({ month_ago: { day: "2026-10-27", active: 128, att_rate: 66.2 } }));
    const [, att, active] = ownerTiles(d);
    expect(att.delta).toEqual({ text: "지난달보다 +5%p", tone: "up" });
    expect(active.delta).toEqual({ text: "지난달보다 +5명", tone: "up" });
  });
});

describe("ownerTodos · ownerStamp · 계산 방법", () => {
  it("오늘 할 일 — 기간 임박은 아래 명단 숫자 · 내려가기", () => {
    const t = ownerTodos(normalizeOwnerHome(raw()), { count: 24, days: 14 });
    expect(t.map((x) => x.text)).toEqual(["기간 임박 24명", "7일 넘게 안 온 회원 26명", "답 못 한 문의 1건"]);
    expect(t[0]).toMatchObject({ jump: true, sub: "D-14 안 · 아래 ① 명단" });
    expect(t[2].sub).toBe("24시간 넘게 연락 전 · 이번 달 문의 3건");
    expect(ownerTodos(normalizeOwnerHome(raw()), { count: 0, days: 14 })[0].jump).toBe(false);
  });

  it("기준 시각 — 6시간 넘게 그대로면 경고", () => {
    const d = normalizeOwnerHome(raw());
    const at = Date.parse("2026-11-26T14:20:23Z");
    expect(ownerStamp(d, at + 60_000)).toEqual({ text: "11/26 23:20 브로제이 기준", warn: null });
    expect(ownerStamp(d, at + 7 * 3600_000).warn).toContain("6시간");
    expect(kstStamp("2026-11-26T15:05:00Z")).toBe("11/27 00:05");
  });

  it("칸을 누르면 — 정의 · 숫자 · 출처", () => {
    const renew = ownerTileHelp("renew", OWNER_DEMO);
    expect(renew.lines[0]).toContain("끝나고 30일 안에 다시 결제한 회원 ÷ 끝난 회원");
    expect(renew.lines).toContain("10월: 끝난 46명 · 30일 안 재등록 15명 · 놓침 28명 · 기다리는 중 3명");
    expect(renew.lines).toContain("12/1에 확정돼요 · 끝나고 30일이 다 지나야 해서요");
    const att = ownerTileHelp("attendance", OWNER_DEMO);
    expect(att.lines).toContain("11/20~11/26: 94명 ÷ 133명 = 70.7%");
    expect(att.foot).toContain("7일 방문");
    expect(ownerTileHelp("active", OWNER_DEMO).lines).toContain("살아 있는 수강권 138명 − 홀딩 5명 = 133명");
    expect(ownerTileHelp("sales", OWNER_DEMO).lines).toContain("11월 1일~11/25: 19,672,440원 (환불 1,028,560원 뺌)");
  });

  it("금액 줄여 쓰기", () => {
    expect(wonShort(19672440)).toBe("1,967만");
    expect(wonShort(-1158560)).toBe("−116만");
    expect(wonShort(9000)).toBe("9,000");
    expect(wonShort(0)).toBe("0");
  });
});
