import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMER,
  clockText,
  cuesBetween,
  cuesToPlay,
  nextPhaseStart,
  normalizeTimer,
  phaseAt,
  phaseLabel,
  presetOf,
  settingsLine,
  totalMs,
  type TimerSettings,
} from "@/lib/boxingTimer";

const S = 1000;
const t3: TimerSettings = { roundSec: 180, restSec: 30, rounds: 3, prepSec: 10, warn10: true };

describe("구간 셈", () => {
  it("준비 → 라운드 → 쉬기 → … → 끝", () => {
    expect(totalMs(t3)).toBe((10 + 3 * 180 + 2 * 30) * S);
    expect(phaseAt(t3, 0)).toMatchObject({ kind: "prep", round: 1, remainingMs: 10 * S });
    expect(phaseAt(t3, 10 * S)).toMatchObject({ kind: "round", round: 1, remainingMs: 180 * S });
    expect(phaseAt(t3, 190 * S)).toMatchObject({ kind: "rest", round: 2, remainingMs: 30 * S });
    expect(phaseAt(t3, 220 * S)).toMatchObject({ kind: "round", round: 2 });
    expect(phaseAt(t3, totalMs(t3)! - 1)).toMatchObject({ kind: "round", round: 3 });
    expect(phaseAt(t3, totalMs(t3)!)).toMatchObject({ kind: "done", remainingMs: 0 });
  });
  it("무제한은 끝나지 않는다", () => {
    const inf = { ...t3, rounds: 0 };
    expect(totalMs(inf)).toBeNull();
    expect(phaseAt(inf, 10 * S + 50 * 210 * S)).toMatchObject({ kind: "round", round: 51 });
  });
  it("건너뛰기 = 다음 구간 시작", () => {
    expect(nextPhaseStart(t3, 3 * S)).toBe(10 * S);
    expect(nextPhaseStart(t3, 50 * S)).toBe(190 * S);
    expect(nextPhaseStart(t3, 200 * S)).toBe(220 * S);
  });
  it("이름 · 시계 글", () => {
    expect(phaseLabel(phaseAt(t3, 0), t3)).toBe("준비");
    expect(phaseLabel(phaseAt(t3, 15 * S), t3)).toBe("1라운드");
    expect(phaseLabel(phaseAt(t3, 200 * S), t3)).toBe("쉬는 시간");
    expect(phaseLabel(phaseAt(t3, totalMs(t3)! - S), t3)).toBe("마지막 라운드");
    expect(clockText(180 * S)).toBe("3:00");
    expect(clockText(200)).toBe("0:01");
    expect(clockText(0)).toBe("0:00");
    expect(settingsLine(DEFAULT_TIMER)).toBe("3분 · 쉬기 30초 · 6라운드");
    expect(presetOf(DEFAULT_TIMER)).toBe("free");
  });
});

describe("소리 신호", () => {
  it("전체 신호 차례", () => {
    const all = cuesBetween(t3, -1, totalMs(t3)!).map((c) => `${c.at / S}:${c.kind}`);
    expect(all).toEqual([
      "7:tick", "8:tick", "9:tick",
      "10:roundStart", "180:warn", "190:roundEnd",
      "217:tick", "218:tick", "219:tick",
      "220:roundStart", "390:warn", "400:roundEnd",
      "427:tick", "428:tick", "429:tick",
      "430:roundStart", "600:warn", "610:finish",
    ]);
  });
  it("준비가 없으면 0초에 공", () => {
    const s = { ...t3, prepSec: 0 };
    expect(cuesBetween(s, -1, 0)).toEqual([{ at: 0, kind: "roundStart", round: 1 }]);
  });
  it("딱딱이를 끄면 없음", () => {
    expect(cuesBetween({ ...t3, warn10: false }, -1, 700 * S).some((c) => c.kind === "warn")).toBe(false);
  });
  it("화면을 껐다 켜서 몇 초가 지나가면 마지막 하나만(1.5초 안)", () => {
    expect(cuesToPlay(t3, 100 * S, 190.5 * S)).toEqual([{ at: 190 * S, kind: "roundEnd", round: 1 }]);
    expect(cuesToPlay(t3, 100 * S, 195 * S)).toEqual([]);
    expect(cuesToPlay(t3, 189.9 * S, 190.0 * S)).toHaveLength(1);
  });
  it("무제한도 신호가 이어진다", () => {
    const inf = { ...t3, rounds: 0 };
    const c = cuesBetween(inf, 1000 * S, 1300 * S).map((x) => x.kind);
    expect(c).toContain("roundStart");
    expect(c).not.toContain("finish");
  });
});

describe("값 다듬기", () => {
  it("범위 · 계단 · 이상한 값", () => {
    expect(normalizeTimer(null)).toEqual(DEFAULT_TIMER);
    expect(normalizeTimer({ roundSec: 5, restSec: 999, rounds: 99, prepSec: 7, warn10: "x" })).toEqual({
      roundSec: 30, restSec: 180, rounds: 20, prepSec: 10, warn10: true,
    });
    expect(normalizeTimer({ roundSec: 100, restSec: 34, rounds: 0, prepSec: 0, warn10: false })).toEqual({
      roundSec: 90, restSec: 30, rounds: 0, prepSec: 0, warn10: false,
    });
  });
});
