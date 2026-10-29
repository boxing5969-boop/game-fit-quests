import { describe, expect, it } from "vitest";
import { OFFICE_DESKS, OFFICE_MEETING_SEATS, deskSpot, meetingSpot, OFFICE_STANDING } from "@/lib/officeLayout";
import { buildAppMenu, flatAppMenu } from "@/lib/appMenu";

describe("지점 회의실 자리 좌표", () => {
  it("서버 자리 이름(boss · mgr · c1~c8 · x1~x4)이 모두 그림 안에 있다", () => {
    const seats = ["boss", "mgr", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "x1", "x2", "x3", "x4"];
    for (const s of seats) {
      const d = OFFICE_DESKS[s];
      expect(d, s).toBeTruthy();
      for (const v of [d.x, d.y, d.tag.x, d.tag.y]) {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThan(100);
      }
      expect(d.clip).toBeGreaterThan(0);
      expect(d.clip).toBeLessThanOrEqual(1);
    }
  });

  it("자리 없는 사람은 문 옆에 선다", () => {
    expect(deskSpot(null)).toBe(OFFICE_STANDING);
    expect(deskSpot("zz")).toBe(OFFICE_STANDING);
    expect(deskSpot("c3")).toBe(OFFICE_DESKS.c3);
  });

  it("회의 탁자는 앞줄 가운데부터 차고, 10명이 넘으면 바닥에 선다", () => {
    expect(meetingSpot(0)).toBe(OFFICE_MEETING_SEATS[0]);
    expect(meetingSpot(0).x).toBeCloseTo(50, 0);
    expect(meetingSpot(9)).toBe(OFFICE_MEETING_SEATS[9]);
    const extra = meetingSpot(10);
    expect(OFFICE_MEETING_SEATS).not.toContain(extra);
    expect(extra.clip).toBe(1);
  });
});

describe("전체 메뉴 — 지점 회의실 칸", () => {
  it("코치진 모두에게 보인다 — 사무실이 없는 지점도 (전략 회의 탭, 2026-10-29)", () => {
    const paths = (office: boolean) => flatAppMenu({ diet: false, staff: true, office }).map((m) => m.path);
    expect(paths(false)).toContain("/office");
    expect(paths(true)).toContain("/office");
  });

  it("전략 회의실 칸은 없다 — 지점 회의실 '전략 회의' 탭으로 합침 (2026-10-29)", () => {
    const paths = flatAppMenu({ diet: false, staff: true, office: true }).map((m) => m.path);
    expect(paths.some((p) => p.includes("tab=strategy"))).toBe(false);
    expect(paths.filter((p) => p === "/office")).toHaveLength(1);
  });

  it("MY복서 바로 다음 칸이다", () => {
    const entries = buildAppMenu({ diet: false, staff: true, office: true });
    const idx = entries.findIndex((e) => "path" in e && e.path === "/myboxer");
    const next = entries[idx + 1];
    expect(next && "path" in next ? next.path : null).toBe("/office");
  });

  it("회원에게는 칸이 없다", () => {
    expect(flatAppMenu({ diet: true, staff: false, office: false }).map((m) => m.path)).not.toContain("/office");
  });
});
