import { describe, expect, it } from "vitest";
import {
  TV_SCREENS,
  normalizeTvModes,
  tvDesired,
  tvNaturalSlot,
  tvRouteFor,
  tvSearchFor,
  tvSlotFrom,
  tvStatusLine,
  tvVisibleSlots,
} from "./tvRemote";

const NOW = Date.parse("2026-11-08T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("TV 화면 바꾸기 — 번호 · 주소", () => {
  it("화면 6개 (모든 모드)", () => {
    expect(TV_SCREENS.map((s) => s.id)).toEqual(["1", "2", "3", "4", "pb1", "pb2"]);
  });

  it("기본이면 그 번호의 원래 화면 · 고르면 그 화면", () => {
    expect(tvDesired("1", "home")).toBe("1");
    expect(tvDesired("4", null)).toBe("4");
    expect(tvDesired("2", "pb2")).toBe("pb2");
  });

  it("주소 — 4는 번호 없이 · 나머지는 끝에", () => {
    expect(tvRouteFor("s", "4")).toBe("/tv/s");
    expect(tvRouteFor("sunreung", "pb1")).toBe("/tv/sunreung/pb1");
  });

  it("TV 번호 — ?tv= 가 있으면 그 번호 · 없으면 원래 번호 (pb1 → 1 · pb2 → 2)", () => {
    expect(tvSlotFrom("?k=abc&tv=3", "1")).toBe("3");
    expect(tvSlotFrom("?tv=9", "2")).toBe("2");
    expect(tvSlotFrom("", null)).toBeNull();
    expect(tvNaturalSlot("pb1")).toBe("1");
    expect(tvNaturalSlot("pb2")).toBe("2");
    expect(tvNaturalSlot("3")).toBe("3");
  });

  it("넘어갈 때 — 열쇠는 그대로 · auto 빼기 · 원래 화면이 아니면 tv=번호", () => {
    expect(tvSearchFor("?k=abc&auto=1", "1", "pb2")).toBe("?k=abc&tv=1");
    expect(tvSearchFor("?k=abc&tv=1", "1", "1")).toBe("?k=abc");
    expect(tvSearchFor("", "4", "4")).toBe("");
    expect(tvSearchFor("?lite=1", "2", "3")).toBe("?lite=1&tv=2");
  });
});

describe("TV 화면 바꾸기 — 앱 화면 상태", () => {
  const raw = {
    slots: [
      { slot: "1", mode: "pb2", set_at: ago(10_000), set_by: "대표", showing: "pb2", seen_at: ago(20_000) },
      { slot: "2", mode: "home", set_at: null, set_by: null, showing: "1", seen_at: ago(5_000) },
      { slot: "3", mode: "home", showing: null, seen_at: null },
      { slot: "4", mode: "weird", showing: "4", seen_at: ago(5 * 3_600_000) },
    ],
  };
  const st = normalizeTvModes(raw);

  it("서버 답 정리 — 모르는 값은 기본으로 · 번호 1~4 늘", () => {
    expect(st.map((s) => s.mode)).toEqual(["pb2", "home", "home", "home"]);
    expect(normalizeTvModes(null)).toHaveLength(4);
  });

  it("켜짐 · 지금 화면 · 바꾸는 중 · 꺼짐", () => {
    expect(tvStatusLine(st[0], NOW)).toEqual({ online: true, text: "켜짐 · 153 PB 기록", pending: false });
    // 아무도 고른 적 없는 번호면 TV 시작 화면 그대로 — 바꾸는 중 아님
    expect(tvStatusLine(st[1], NOW)).toMatchObject({ online: true, pending: false, text: "켜짐 · 지금 운동 중" });
    // 기본으로 고른 뒤인데 다른 화면이면 바꾸는 중
    expect(tvStatusLine({ ...st[1], setAt: ago(3000) }, NOW)).toMatchObject({ online: true, pending: true, text: "바꾸는 중…" });
    expect(tvStatusLine(st[2], NOW).text).toBe("아직 이 번호로 켠 TV가 없어요");
    expect(tvStatusLine(st[3], NOW)).toMatchObject({ online: false, text: "꺼져 있어요 · 마지막 5시간 전" });
  });

  it("1 · 2번 기본 화면이 짝 PB 화면이면 = 측정 중 자동 전환", () => {
    const s = { slot: "2" as const, mode: "home" as const, setAt: ago(60_000), setBy: null, showing: "pb2" as const, seenAt: ago(5000) };
    expect(tvStatusLine(s, NOW)).toEqual({ online: true, text: "켜짐 · 153 PB 기록 · 측정 중 자동", pending: false });
    expect(tvStatusLine({ ...s, showing: "pb1" }, NOW).pending).toBe(true); // 2번이 pb1 이면 자동 전환이 아님
  });

  it("보일 줄 — 1 · 2번은 늘, 3 · 4번은 켠 적이 있거나 골라 둔 것만", () => {
    expect(tvVisibleSlots(st).map((s) => s.slot)).toEqual(["1", "2", "4"]);
  });
});
