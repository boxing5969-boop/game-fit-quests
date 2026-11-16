import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  GROWTH_MARKS_MAX,
  growthMarksKey,
  markHeart,
  markOpened,
  markPick,
  parseGrowthMarks,
  readGrowthMarks,
  trimGrowthMarks,
  useGrowthMarks,
  writeGrowthMarks,
  type GrowthMarks,
} from "./growthRead";

beforeEach(() => {
  localStorage.clear();
});

describe("오늘의 1분 성장 — 이 기기 기록 다듬기", () => {
  it("기기 값을 믿지 않는다 — 모르는 모양은 버린다", () => {
    expect(parseGrowthMarks(null)).toEqual({});
    expect(parseGrowthMarks("{깨진 글")).toEqual({});
    expect(parseGrowthMarks("[1,2]")).toEqual({});
    expect(parseGrowthMarks(42)).toEqual({});
    const raw = JSON.stringify({
      "ox-ring-square": { o: "2026-11-17", q: "X", h: true, extra: "버림" },
      "jab-return": { o: "어제", q: "Y", h: "yes" }, // 다 틀린 값 → 줄째 버림
      "Bad Id": { o: "2026-11-17" },
      "habit-66days": "글자",
      "mood-1039": { q: "O" },
    });
    expect(parseGrowthMarks(raw)).toEqual({
      "ox-ring-square": { o: "2026-11-17", q: "X", h: true },
      "mood-1039": { q: "O" },
    });
  });

  it("120편이 넘으면 최근에 연 글부터 남긴다", () => {
    const many: Record<string, { o: string }> = {};
    for (let i = 0; i < GROWTH_MARKS_MAX + 30; i++) {
      const day = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
      many[`piece-${i}`] = { o: day };
    }
    const kept = trimGrowthMarks(many);
    expect(Object.keys(kept)).toHaveLength(GROWTH_MARKS_MAX);
    expect(kept["piece-0"]).toBeUndefined();
    expect(kept[`piece-${GROWTH_MARKS_MAX + 29}`]).toBeTruthy();
    // 넘지 않으면 그대로(같은 값)
    const few: GrowthMarks = { a1: { o: "2026-11-16" } };
    expect(trimGrowthMarks(few)).toBe(few);
  });
});

describe("오늘의 1분 성장 — 기록 남기기", () => {
  it("처음 연 날만 남는다", () => {
    const a = markOpened({}, "jab-return", "2026-11-18");
    expect(a).toEqual({ "jab-return": { o: "2026-11-18" } });
    // 다른 날 다시 열어도 그대로 (같은 값 그대로 돌려준다)
    expect(markOpened(a, "jab-return", "2026-11-20")).toBe(a);
  });

  it("O/X 는 처음 고른 답만", () => {
    const a = markPick({ "ox-ring-square": { o: "2026-11-17" } }, "ox-ring-square", "O", "2026-11-17");
    expect(a["ox-ring-square"]).toEqual({ o: "2026-11-17", q: "O" });
    expect(markPick(a, "ox-ring-square", "X", "2026-11-18")).toBe(a);
    // 연 기록이 없어도 고른 날을 연 날로
    expect(markPick({}, "ox-glove-oz", "O", "2026-11-24")).toEqual({ "ox-glove-oz": { o: "2026-11-24", q: "O" } });
  });

  it("좋아요는 켜고 끈다 — 다른 기록은 그대로", () => {
    const base: GrowthMarks = { "ox-ring-square": { o: "2026-11-17", q: "X" } };
    const on = markHeart(base, "ox-ring-square", true, "2026-11-17");
    expect(on["ox-ring-square"]).toEqual({ o: "2026-11-17", q: "X", h: true });
    expect(markHeart(on, "ox-ring-square", true, "2026-11-17")).toBe(on);
    const off = markHeart(on, "ox-ring-square", false, "2026-11-17");
    expect(off["ox-ring-square"]).toEqual({ o: "2026-11-17", q: "X" });
    expect(markHeart(off, "ox-ring-square", false, "2026-11-17")).toBe(off);
  });
});

describe("오늘의 1분 성장 — 계정마다 한 칸", () => {
  it("계정마다 따로 저장한다", () => {
    writeGrowthMarks("u1", { "jab-return": { o: "2026-11-18" } });
    expect(readGrowthMarks("u1")).toEqual({ "jab-return": { o: "2026-11-18" } });
    expect(readGrowthMarks("u2")).toEqual({});
    expect(localStorage.getItem(growthMarksKey("u1"))).toContain("jab-return");
  });

  it("고치면 바로 저장하고, 계정이 바뀌면 그 계정 것을 읽는다 (섞이지 않는다)", () => {
    writeGrowthMarks("u2", { "mood-1039": { o: "2026-11-19", h: true } });
    const { result, rerender } = renderHook(({ uid }) => useGrowthMarks(uid), { initialProps: { uid: "u1" } });
    expect(result.current[0]).toEqual({});
    act(() => result.current[1]((m) => markOpened(m, "jab-return", "2026-11-18")));
    expect(result.current[0]).toEqual({ "jab-return": { o: "2026-11-18" } });
    expect(readGrowthMarks("u1")).toEqual({ "jab-return": { o: "2026-11-18" } });

    rerender({ uid: "u2" });
    expect(result.current[0]).toEqual({ "mood-1039": { o: "2026-11-19", h: true } });
    act(() => result.current[1]((m) => markHeart(m, "mood-1039", false, "2026-11-19")));
    expect(readGrowthMarks("u2")).toEqual({ "mood-1039": { o: "2026-11-19" } });
    // 앞 계정 기록은 그대로
    expect(readGrowthMarks("u1")).toEqual({ "jab-return": { o: "2026-11-18" } });
  });
});
