import { describe, expect, it } from "vitest";
import { QR_ONLY_BRANCHES, boardQrNotice, isQrOnlyBranch } from "./checkinMode";

describe("지점별 출석 방식 — 칠금점은 QR 로만 (2026-10-21)", () => {
  it("칠금점만 QR 출석 지점", () => {
    expect(QR_ONLY_BRANCHES).toEqual(["153복싱짐 칠금점"]);
    expect(isQrOnlyBranch("153복싱짐 칠금점")).toBe(true);
    for (const b of ["153복싱짐 선릉역점", "153복싱짐 역삼점", "153복싱짐 잠실점", "", null, undefined]) {
      expect(isQrOnlyBranch(b)).toBe(false);
    }
  });

  it("TV QR 안내 — 칠금점엔 브로제이 이야기를 하지 않는다", () => {
    const c = boardQrNotice("153복싱짐 칠금점");
    expect(`${c.main} ${c.sub}`).not.toContain("브로제이");
    expect(c.main).toContain("QR");
    // 선릉역점 등은 예전 문구 그대로 (대표님 문구)
    expect(boardQrNotice("153복싱짐 선릉역점").main).toBe("브로제이 서버 불안정으로 인해 출석 반영이 늦어지고 있어요~");
    expect(boardQrNotice("153복싱짐 선릉역점").sub).toBe("앱에서 QR을 통해 출석체크 부탁드립니다");
  });
});
