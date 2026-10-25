import { describe, expect, it } from "vitest";
import {
  AREA_BAR_FULL_PCT,
  EMPTY_FITNESS_PROFILE,
  areaChangePct,
  areaRows,
  areaValueText,
  bestImprovedArea,
  gripText,
  kstMonthDay,
  measureErrorText,
  measureInputError,
  nextTestText,
  normalizeAreas,
  normalizeFitnessProfile,
  parseMeasure,
  pbLine,
  recordTimeText,
  relGripPct,
  resultSummary,
  shownDivision,
} from "./test153Profile";

// get_my_fitness_profile 이 운영 DB 에서 실제로 돌려준 모양 (2026-10-25 되돌림 시험 · 가짜 기록 3 + 스타터 타임캡 1)
const areasA = {
  legs: { ms: 140000, reps: 90, per_min: 38.6 },
  upper: { ms: 135000, reps: 70, per_min: 31.1 },
  boxing: { ms: 215000 },
  cardio: { runs_ms: [30000, 30000, 30000, 30000, 30000, 30000, 33000, 34000], run_avg_ms: 30875, pace_keep_pct: 89.6 },
  rhythm: { ms: 100000, reps: 200, per_min: 120.0 },
  done_segments: 16,
};
const areasB = {
  legs: { ms: 130000, reps: 90, per_min: 41.5 },
  upper: { ms: 127000, reps: 70, per_min: 33.1 },
  boxing: { ms: 205000 },
  cardio: { runs_ms: [29000, 29000, 29000, 29000, 29000, 29000, 31000, 31500], run_avg_ms: 29563, pace_keep_pct: 92.8 },
  rhythm: { ms: 95000, reps: 200, per_min: 126.3 },
  done_segments: 16,
};
const areasC = {
  legs: { ms: 123000, reps: 90, per_min: 43.9 },
  upper: { ms: 123000, reps: 70, per_min: 34.1 },
  boxing: { ms: 203000 },
  cardio: { runs_ms: [28500, 28500, 28500, 28500, 28500, 28500, 30000, 30500], run_avg_ms: 28938, pace_keep_pct: 94.2 },
  rhythm: { ms: 96000, reps: 200, per_min: 125.0 },
  done_segments: 16,
};
const areasS = { legs: null, upper: null, boxing: null, cardio: null, rhythm: null, done_segments: 9 };

const recA = { id: "a", areas: areasA, finished: true, score_ms: 837000, total_ms: 837000, measured_at: "2026-10-01T10:00:00+00:00", remaining_reps: 0 };
const recB = { id: "b", areas: areasB, finished: true, score_ms: 793500, total_ms: 793500, measured_at: "2026-10-15T10:00:00+00:00", remaining_reps: 0 };
const recC = { id: "c", areas: areasC, finished: true, score_ms: 776500, total_ms: 776500, measured_at: "2026-10-24T10:00:00+00:00", remaining_reps: 0 };
const recS = { id: "s", areas: areasS, finished: false, score_ms: 1620000, total_ms: 1500000, measured_at: "2026-10-20T10:00:00+00:00", remaining_reps: 120 };

const server = {
  grip: { kg: 42.3, on: "2026-10-25", source: "coach", rel_pct: 56.4, first_kg: 42.3, first_on: "2026-10-25", weight_kg: 75.0 },
  waist: { cm: 82.5, on: "2026-10-25" },
  primary: "open",
  rest_hr: { on: "2026-10-25", bpm: 61.0 },
  divisions: {
    open: { pb: recC, prev: recB, count: 3, first: recA, latest: { ...recC, coach_name: "박성현" }, improved_ms: 60500, improved_pct: 7.2 },
    starter: { pb: recS, prev: null, count: 1, first: recS, latest: { ...recS, coach_name: "박성현" }, improved_ms: null, improved_pct: null },
  },
  percentile: null,
  fitness_age: null,
  has_records: true,
  next_test_on: "2026-12-05",
  measure_count: 3,
  last_measured_at: "2026-10-24T10:00:00+00:00",
};

describe("normalizeFitnessProfile", () => {
  it("모양이 틀리면 빈 프로필", () => {
    expect(normalizeFitnessProfile(null)).toEqual(EMPTY_FITNESS_PROFILE);
    expect(normalizeFitnessProfile("x")).toEqual(EMPTY_FITNESS_PROFILE);
    expect(normalizeFitnessProfile({ has_records: false, divisions: {} })).toEqual({ ...EMPTY_FITNESS_PROFILE });
  });

  it("서버 값을 그대로 옮긴다", () => {
    const p = normalizeFitnessProfile(server);
    expect(p.hasRecords).toBe(true);
    expect(p.primary).toBe("open");
    expect(p.nextTestOn).toBe("2026-12-05");
    expect(p.grip).toEqual({ kg: 42.3, on: "2026-10-25", source: "coach", weightKg: 75, relPct: 56.4, firstKg: 42.3, firstOn: "2026-10-25" });
    expect(p.waist).toEqual({ cm: 82.5, on: "2026-10-25" });
    expect(p.restHr).toEqual({ bpm: 61, on: "2026-10-25" });
    expect(p.measureCount).toBe(3);
    const open = p.divisions.open!;
    expect(open.count).toBe(3);
    expect(open.latest.coachName).toBe("박성현");
    expect(open.prev?.id).toBe("b");
    expect(open.improvedMs).toBe(60500);
    expect(open.improvedPct).toBe(7.2);
    expect(open.latest.areas?.cardio?.runAvgMs).toBe(28938);
    expect(p.divisions.starter?.prev).toBeNull();
    expect(shownDivision(p)?.division).toBe("open");
  });

  it("primary 부문이 없으면 있는 부문으로", () => {
    const p = normalizeFitnessProfile({ ...server, primary: "open", divisions: { starter: server.divisions.starter } });
    expect(p.primary).toBe("starter");
    expect(shownDivision(p)?.division).toBe("starter");
  });
});

describe("영역", () => {
  it("끝내지 못한 영역은 null", () => {
    const a = normalizeAreas(areasS)!;
    expect(a.doneSegments).toBe(9);
    expect(a.cardio).toBeNull();
    expect(areaValueText(a, "legs")).toBeNull();
  });

  it("값 한 줄", () => {
    const c = normalizeAreas(areasC);
    expect(areaValueText(c, "cardio")).toBe("평균 28.9초 · 끝까지 속도 94% 유지");
    expect(areaValueText(c, "legs")).toBe("1분에 43.9개");
    expect(areaValueText(c, "upper")).toBe("1분에 34.1개");
    expect(areaValueText(c, "boxing")).toBe("세 구간 3:23.0");
    expect(areaValueText(c, "rhythm")).toBe("1분에 125회");
  });

  it("좋아진 비율 — 시간은 줄수록, 개수는 늘수록 양수", () => {
    const a = normalizeAreas(areasA);
    const c = normalizeAreas(areasC);
    expect(areaChangePct(a, c, "cardio")).toBe(6.3);
    expect(areaChangePct(a, c, "legs")).toBe(13.7);
    expect(areaChangePct(a, c, "boxing")).toBe(5.6);
    expect(areaChangePct(c, a, "legs")).toBeLessThan(0);
    expect(areaChangePct(null, c, "legs")).toBeNull();
    expect(areaChangePct(a, normalizeAreas(areasS), "legs")).toBeNull();
  });

  it("카드 5줄 — 처음보다 좋아진 것만 막대", () => {
    const open = normalizeFitnessProfile(server).divisions.open!;
    const rows = areaRows(open);
    expect(rows.map((r) => r.key)).toEqual(["cardio", "legs", "upper", "boxing", "rhythm"]);
    const legs = rows.find((r) => r.key === "legs")!;
    expect(legs.gainPct).toBe(13.7);
    expect(legs.ratio).toBeCloseTo(13.7 / AREA_BAR_FULL_PCT, 5);
    expect(rows.find((r) => r.key === "rhythm")!.gainPct).toBe(4.2);
  });

  it("기록이 하나면 막대 없이 값만", () => {
    const starter = normalizeFitnessProfile(server).divisions.starter!;
    const rows = areaRows(starter);
    expect(rows.every((r) => r.gainPct == null && r.ratio === 0)).toBe(true);
    expect(rows.every((r) => r.value == null)).toBe(true);
  });

  it("가장 좋아진 영역 — 줄어든 영역은 고르지 않는다", () => {
    const best = bestImprovedArea(normalizeAreas(areasB), normalizeAreas(areasC));
    expect(best).toEqual({ key: "legs", label: "하체 근지구력", pct: 5.8 });
    expect(bestImprovedArea(normalizeAreas(areasC), normalizeAreas(areasC))).toBeNull();
  });
});

describe("문구", () => {
  it("PB 아래 한 줄", () => {
    const p = normalizeFitnessProfile(server);
    expect(pbLine(p.divisions.open!)).toBe("첫 기록보다 1분 1초 빨라졌어요 (7.2%)");
    expect(pbLine(p.divisions.starter!)).toBe("첫 공식 기록이에요 — 다음 측정부터 얼마나 좋아졌는지 보여 드려요");
    const firstCapped = { ...p.divisions.open!, first: { ...p.divisions.open!.first, finished: false }, improvedMs: null, improvedPct: null };
    expect(pbLine(firstCapped)).toBe("처음엔 25분 안에 다 못 했는데, 이제 완주해요");
    const same = { ...p.divisions.open!, improvedMs: null, improvedPct: null };
    expect(pbLine(same)).toBe("다음 목표는 PB보다 1초 빠르게");
  });

  it("기록 시간", () => {
    const p = normalizeFitnessProfile(server);
    expect(recordTimeText(p.divisions.open!.latest)).toBe("12:56.5");
    expect(recordTimeText(p.divisions.starter!.latest)).toBe("25:00 + 남은 120개");
  });

  it("한국 날짜", () => {
    expect(kstMonthDay("2026-10-24T10:00:00+00:00")).toBe("10월 24일");
    expect(kstMonthDay("2026-10-24T20:00:00+00:00")).toBe("10월 25일");
    expect(kstMonthDay("2026-12-05")).toBe("12월 5일");
    expect(kstMonthDay(null)).toBe("");
  });

  it("다음 측정", () => {
    expect(nextTestText("2026-12-05", "2026-10-25")).toBe("12월 5일 · D-41");
    expect(nextTestText("2026-12-05", "2026-12-05")).toBe("오늘이에요");
    expect(nextTestText("2026-12-05", "2026-12-09")).toBe("다시 잴 때예요 — 코치님께 말씀해 주세요");
    expect(nextTestText(null, "2026-10-25")).toBeNull();
  });

  it("악력", () => {
    const p = normalizeFitnessProfile(server);
    expect(gripText(p.grip)).toBe("악력 42.3kg · 몸무게의 56%");
    expect(gripText({ ...p.grip!, relPct: null })).toBe("악력 42.3kg");
    expect(gripText(null)).toBeNull();
  });

  it("몸무게 대비 악력 — 서버 rel_pct 와 같은 식", () => {
    expect(relGripPct(42.3, 75)).toBe(56);
    expect(relGripPct(28, 52.4)).toBe(53);
    expect(relGripPct(42.3, null)).toBeNull();
    expect(relGripPct(null, 75)).toBeNull();
    expect(relGripPct(NaN, 75)).toBeNull();
    expect(relGripPct(95, 75)).toBeNull();
    expect(relGripPct(42.3, 20)).toBeNull();
  });

  it("측정 직후 결과 한 장", () => {
    const s = resultSummary(normalizeFitnessProfile(server).divisions.open!);
    expect(s.thisText).toBe("12:56.5");
    expect(s.prevText).toBe("13:13.5");
    expect(s.fasterMs).toBe(17000);
    expect(s.isPb).toBe(true);
    expect(s.best?.key).toBe("legs");
    expect(s.changes.find((c) => c.key === "rhythm")!.pct).toBeNull();
    expect(s.changes.find((c) => c.key === "cardio")!.pct).toBe(2.1);
  });

  it("첫 측정이면 지난번이 없다", () => {
    const s = resultSummary(normalizeFitnessProfile(server).divisions.starter!);
    expect(s.prevText).toBeNull();
    expect(s.fasterMs).toBeNull();
    expect(s.best).toBeNull();
  });
});

describe("입력 확인", () => {
  it("숫자 꼴", () => {
    expect(parseMeasure("grip_kg", "42.5")).toBe(42.5);
    expect(parseMeasure("grip_kg", "42,5")).toBe(42.5);
    expect(parseMeasure("grip_kg", "42.55")).toBeNaN();
    expect(parseMeasure("rest_hr", "61")).toBe(61);
    expect(parseMeasure("rest_hr", "61.5")).toBeNaN();
    expect(parseMeasure("waist_cm", "  ")).toBeNull();
  });

  it("범위", () => {
    expect(measureInputError("waist_cm", 82.5)).toBeNull();
    expect(measureInputError("waist_cm", null)).toBeNull();
    expect(measureInputError("waist_cm", 49)).toBe("허리둘레는 50~150cm 사이 숫자로 넣어 주세요 (소수 한 자리까지)");
    expect(measureInputError("rest_hr", NaN)).toBe("안정시 심박은 35~120회/분 사이 숫자로 넣어 주세요 (정수로)");
    expect(measureInputError("grip_kg", 95)).toBe("악력은 5~90kg 사이 숫자로 넣어 주세요 (소수 한 자리까지)");
  });

  it("서버 오류 한 줄", () => {
    expect(measureErrorText({ message: "fitness_measure_range" })).toBe("넣을 수 있는 범위를 벗어났어요. 숫자를 다시 확인해 주세요");
    expect(measureErrorText(new Error("fitness_measure_forbidden"))).toBe("같은 지점 코치님만 넣을 수 있어요");
    expect(measureErrorText("x")).toBe("저장하지 못했어요. 잠시 뒤 다시 해 주세요");
  });
});
