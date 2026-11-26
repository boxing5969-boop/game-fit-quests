import { describe, expect, it } from "vitest";
import { isOpsDay, matchOpsBranch, opsWorkLink, ptCheckTarget } from "./opsLink";

const BRANCHES = ["153복싱짐 선릉역점", "153복싱짐 칠금점"];

describe("링크의 지점 맞추기", () => {
  it.each([
    ["선릉역점", "153복싱짐 선릉역점"],
    ["153복싱짐 선릉역점", "153복싱짐 선릉역점"],
    ["153복싱짐선릉역점", "153복싱짐 선릉역점"],
    [" 칠금점 ", "153복싱짐 칠금점"],
  ])("'%s' → %s", (want, hit) => {
    expect(matchOpsBranch(BRANCHES, want)).toBe(hit);
  });
  it.each([null, "", "잠실점", "153복싱짐"])("'%s' → 없음", (want) => {
    expect(matchOpsBranch(BRANCHES, want)).toBeNull();
  });
  it("서버가 %로 바꿔 넣은 이름도 주소 칸에서 풀리면 같다", () => {
    const b = new URLSearchParams("tab=work&pt=check&b=%EC%84%A0%EB%A6%89%EC%97%AD%EC%A0%90").get("b");
    expect(matchOpsBranch(BRANCHES, b)).toBe("153복싱짐 선릉역점");
  });
});

describe("근무 탭 링크 만들기", () => {
  it("값은 % 로 · 빈 값은 뺀다", () => {
    expect(opsWorkLink({ pt: "check", b: "선릉역점" })).toBe("/office?tab=work&pt=check&b=%EC%84%A0%EB%A6%89%EC%97%AD%EC%A0%90");
    expect(opsWorkLink({ pt: "check", b: null })).toBe("/office?tab=work&pt=check");
    expect(opsWorkLink({ staffname: "이 재현", day: "2026-11-25" })).toBe("/office?tab=work&staffname=%EC%9D%B4%20%EC%9E%AC%ED%98%84&day=2026-11-25");
  });
  it("날짜 모양", () => {
    expect(isOpsDay("2026-11-25")).toBe(true);
    expect(isOpsDay("11/25")).toBe(false);
    expect(isOpsDay(null)).toBe(false);
  });
});

describe("PT 이틀 넘은 확인 — 열 곳", () => {
  it("확인할 코치가 한 명이면 그 코치", () => {
    expect(ptCheckTarget(["a"], ["a", "b"])).toEqual({ kind: "coach", staffId: "a" });
  });
  it("확인할 코치가 여럿이면 '확인할 것'", () => {
    expect(ptCheckTarget(["a", "b"], ["a", "b"])).toEqual({ kind: "list" });
  });
  it("그사이 다 처리됐으면 — PT 코치 한 명이면 그 코치 · 여럿이면 목록 · 없으면 그대로", () => {
    expect(ptCheckTarget([], ["a"])).toEqual({ kind: "coach", staffId: "a" });
    expect(ptCheckTarget([], ["a", "b"])).toEqual({ kind: "list" });
    expect(ptCheckTarget([], [])).toEqual({ kind: "none" });
  });
  it("같은 코치가 두 번 와도 한 명", () => {
    expect(ptCheckTarget(["a", "a"], ["a", "b"])).toEqual({ kind: "coach", staffId: "a" });
  });
});
