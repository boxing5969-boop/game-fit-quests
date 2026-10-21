import { describe, expect, it } from "vitest";
import { isPilotBranch, PILOT_BRANCHES } from "./pilotBranches";
import { isTitleFlowFor } from "./titleMatchChallenge";
import { authorityLabel, withBranchAuthority } from "./levelAuthority";

const SUN = "153복싱짐 선릉역점";
const JAM = "153복싱짐 잠실점";
const YEOK = "153복싱짐 역삼점";

const CHIL = "153복싱짐 칠금점";

describe("시범 지점 (선릉역점 · 칠금점)", () => {
  it("선릉역점 · 칠금점 — 잠실·역삼·본사·빈 값은 아니다 (2026-10-21 칠금점 추가)", () => {
    expect(PILOT_BRANCHES).toEqual([SUN, CHIL]);
    expect(isPilotBranch(SUN)).toBe(true);
    expect(isPilotBranch(CHIL)).toBe(true);
    for (const b of [JAM, YEOK, "153본사", "", null, undefined, " 153복싱짐 선릉역점"]) {
      expect(isPilotBranch(b)).toBe(false);
    }
  });

  it("화이트 타이틀매치 신청 흐름 = 화이트 리그 + 시범 지점", () => {
    expect(isTitleFlowFor("white", SUN)).toBe(true);
    expect(isTitleFlowFor("white", CHIL)).toBe(true);
    expect(isTitleFlowFor("white", JAM)).toBe(false);
    expect(isTitleFlowFor("white", YEOK)).toBe(false);
    expect(isTitleFlowFor("white", null)).toBe(false);
    expect(isTitleFlowFor("blue", SUN)).toBe(false);
  });

  it("승인 주체 — 시범 지점이 아니면 화이트 레벨 10은 담당 코치님 (블루 이후는 그대로)", () => {
    const rules = [
      { rank: "white", levelAuthority: "coach", titleAuthority: "manager" },
      { rank: "blue", levelAuthority: "coach", titleAuthority: "manager" },
      { rank: "red", levelAuthority: "coach", titleAuthority: "owner" },
    ];
    expect(withBranchAuthority(rules, SUN)).toBe(rules); // 그대로 (같은 배열)
    const jam = withBranchAuthority(rules, JAM)!;
    expect(jam[0].titleAuthority).toBe("coach");
    expect(jam[1].titleAuthority).toBe("manager");
    expect(jam[2].titleAuthority).toBe("owner");
    expect(rules[0].titleAuthority).toBe("manager"); // 원본은 건드리지 않는다
    expect(authorityLabel(jam, "white", 10)).toBe("담당 코치님");
    expect(authorityLabel(withBranchAuthority(rules, SUN), "white", 10)).toBe("지점장·관장님");
    expect(withBranchAuthority(undefined, JAM)).toBeUndefined();
  });
});
