import { afterEach, describe, expect, it } from "vitest";
import { canViewAsMember, effectiveRole, readViewAsMember, viewAsMemberKey, viewBranchLabel, writeViewAsMember } from "./viewAsMember";

describe("viewAsMember", () => {
  afterEach(() => window.localStorage.clear());

  it("본사(전체관리자 · 관리자)만 쓸 수 있다", () => {
    expect(canViewAsMember("super_admin")).toBe(true);
    expect(canViewAsMember("admin")).toBe(true);
    expect(canViewAsMember("branch_manager")).toBe(false);
    expect(canViewAsMember("coach")).toBe(false);
    expect(canViewAsMember("member")).toBe(false);
    expect(canViewAsMember(null)).toBe(false);
  });

  it("켜면 화면 역할은 member, 끄면 그대로", () => {
    expect(effectiveRole("super_admin", true)).toBe("member");
    expect(effectiveRole("super_admin", false)).toBe("super_admin");
    expect(effectiveRole("admin", true)).toBe("member");
    // 본사가 아니면 켜져 있어도 바뀌지 않는다
    expect(effectiveRole("branch_manager", true)).toBe("branch_manager");
    expect(effectiveRole("coach", true)).toBe("coach");
    expect(effectiveRole(null, true)).toBeNull();
  });

  it("이 기기 · 계정마다 저장", () => {
    expect(readViewAsMember("u1")).toBe(false);
    writeViewAsMember("u1", true);
    expect(window.localStorage.getItem(viewAsMemberKey("u1"))).toBe("1");
    expect(readViewAsMember("u1")).toBe(true);
    expect(readViewAsMember("u2")).toBe(false);
    writeViewAsMember("u1", false);
    expect(readViewAsMember("u1")).toBe(false);
    expect(readViewAsMember(null)).toBe(false);
  });

  it("지점 이름", () => {
    expect(viewBranchLabel("153복싱짐 선릉역점")).toBe("선릉역점");
    expect(viewBranchLabel("153본사")).toBe("153본사");
    expect(viewBranchLabel(null)).toBe("지점 미지정");
  });
});
