import { describe, expect, it } from "vitest";
import {
  defaultFixNo,
  EXTRA_THEME,
  markTrend,
  needsObservation,
  pct,
  planPhase,
  rateOfMarks,
  sayLines,
  shortDay,
  strongestStd,
  toggleMark,
  weakestStd,
  weekPlan,
  type GrowthPerson,
  type GrowthPlan,
} from "./coachGrowth";

const plan = (p: Partial<GrowthPlan>): GrowthPlan => ({ id: "p", start_on: "2026-11-02", weeks: 4, status: "active", week_no: 1, ...p });

describe("weekPlan", () => {
  it("1~4주는 정해진 주제", () => {
    expect(weekPlan(1, null).theme).toBe("이름과 인사");
    expect(weekPlan(2, null).focus).toEqual([3, 4]);
    expect(weekPlan(4, null).focus).toEqual([1, 2, 3, 4, 5]);
  });
  it("시작 전(0)은 1주차를 미리", () => {
    expect(weekPlan(0, null).week).toBe(1);
  });
  it("5주차부터는 가장 약한 한 가지", () => {
    const w = weekPlan(5, 3);
    expect(w.theme).toBe(EXTRA_THEME);
    expect(w.focus).toEqual([3]);
    expect(weekPlan(6, null).focus).toEqual([1]);
  });
});

describe("planPhase", () => {
  it("과정 없음 · 시작 전 · 진행 · 돌아보기 · 끝", () => {
    expect(planPhase(null)).toBe("none");
    expect(planPhase(plan({ week_no: 0 }))).toBe("before");
    expect(planPhase(plan({ week_no: 3 }))).toBe("running");
    expect(planPhase(plan({ week_no: 5 }))).toBe("review");
    expect(planPhase(plan({ week_no: 5, weeks: 6 }))).toBe("running");
    expect(planPhase(plan({ status: "done", week_no: 9 }))).toBe("done");
  });
});

describe("점수", () => {
  it("했어요 1 · 조금 0.5 · 못 했어요 0", () => {
    expect(rateOfMarks(["y", "s", "n", "y"])).toBeCloseTo(0.625);
    expect(rateOfMarks([])).toBeNull();
    expect(rateOfMarks([null, undefined])).toBeNull();
  });
  it("pct 는 0~100 정수", () => {
    expect(pct(0.625)).toBe(63);
    expect(pct(null)).toBeNull();
    expect(pct(1.4)).toBe(100);
  });
  it("가장 약한 · 잘하는 기준 (같으면 번호 앞)", () => {
    const rates = { "1": { rate: 0.5, n: 2 }, "2": { rate: 1, n: 3 }, "3": { rate: 0.5, n: 4 }, "4": { rate: 0.2, n: 1 } };
    expect(weakestStd(rates, [1, 2, 3, 4, 5])).toBe(4);
    expect(weakestStd(rates, [1, 2, 3, 4, 5], 2)).toBe(1);
    expect(strongestStd(rates, [1, 2, 3, 4, 5])).toBe(2);
    expect(weakestStd({}, [1, 2])).toBeNull();
  });
});

describe("markTrend", () => {
  it("첫 관찰 → 마지막 관찰", () => {
    const first = { "1": "n", "2": "y" } as const;
    const last = { "1": "y", "2": "s" } as const;
    expect(markTrend(first, last, 1)).toBe("up");
    expect(markTrend(first, last, 2)).toBe("down");
    expect(markTrend(first, { "1": "n" }, 1)).toBe("same");
    expect(markTrend(first, first, 1)).toBeNull();
    expect(markTrend(null, last, 1)).toBeNull();
  });
});

describe("defaultFixNo · toggleMark", () => {
  it("가장 낮은 칸 — 못 했어요가 조금보다 먼저", () => {
    expect(defaultFixNo({ "1": "s", "2": "n", "3": "n" }, [1, 2, 3])).toBe(2);
    expect(defaultFixNo({ "1": "y" }, [1, 2])).toBeNull();
  });
  it("같은 칸을 다시 누르면 지운다", () => {
    const a = toggleMark({}, 1, "y");
    expect(a).toEqual({ "1": "y" });
    expect(toggleMark(a, 1, "y")).toEqual({});
    expect(toggleMark(a, 1, "n")).toEqual({ "1": "n" });
  });
});

describe("그 밖", () => {
  it("이번 주 관찰이 없는 진행 중 코치님만", () => {
    const base: Omit<GrowthPerson, "plan" | "obs_week"> = {
      person: null, self: {}, obs: {}, checks_total: 0, checks_week: 0, obs_total: 0,
      last_obs_at: null, unseen: 0, first_marks: null, last_marks: null,
    };
    const people: GrowthPerson[] = [
      { ...base, plan: plan({ week_no: 2 }), obs_week: 0 },
      { ...base, plan: plan({ week_no: 2 }), obs_week: 1 },
      { ...base, plan: null, obs_week: 0 },
    ];
    expect(needsObservation(people)).toHaveLength(1);
  });
  it("이렇게 말해요 줄 나누기 · 날짜", () => {
    expect(sayLines('"하나"\n\n "둘" ')).toEqual(['"하나"', '"둘"']);
    expect(shortDay("2026-11-05")).toBe("11/5");
    expect(shortDay(null)).toBe("");
  });
});
