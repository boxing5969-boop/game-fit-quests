import { describe, expect, it } from "vitest";

import {
  DIET_METRIC_THRESHOLDS,
  DIET_SCORE_WEIGHTS,
  compute21DayCompletionRate,
  computeDietDailyScore,
  computeDietWeeklyScore,
  computeMissionCompletionRate,
  isLogEmpty,
  scoreFromLogRow,
} from "./scoreEngine";

describe("computeDietDailyScore — 비중 4분할", () => {
  it("전부 달성 시 100점", () => {
    const r = computeDietDailyScore({
      gymAttended: true,
      photosCount: 2,
      waterMl: 2000,
      sleepHours: 7.5,
      stepCount: 9000,
      hasWeeklyReview: true,
    });
    expect(r.total).toBe(100);
    expect(r.attendance).toBe(DIET_SCORE_WEIGHTS.attendance);
    expect(r.photoProof).toBe(DIET_SCORE_WEIGHTS.photoProof);
    expect(r.metricsHits).toBe(3);
  });

  it("전부 미충족 시 0점", () => {
    const r = computeDietDailyScore({
      gymAttended: false,
      photosCount: 0,
      waterMl: 0,
      sleepHours: 0,
      stepCount: 0,
      hasWeeklyReview: false,
    });
    expect(r.total).toBe(0);
  });

  it("null 응답은 0점 취급 (감점 금지)", () => {
    const r = computeDietDailyScore({
      gymAttended: null,
      photosCount: 0,
      waterMl: null,
      sleepHours: null,
      stepCount: null,
      hasWeeklyReview: false,
    });
    expect(r.total).toBe(0);
    expect(r.attendance).toBe(0);
    expect(r.photoProof).toBe(0);
    expect(r.metricsHits).toBe(0);
  });

  it("사진만 있을 때", () => {
    const r = computeDietDailyScore({
      gymAttended: null,
      photosCount: 1,
      waterMl: null,
      sleepHours: null,
      stepCount: null,
      hasWeeklyReview: false,
    });
    expect(r.total).toBe(DIET_SCORE_WEIGHTS.photoProof);
  });

  it("출석 + 3수치 임계값 정확히 충족", () => {
    const r = computeDietDailyScore({
      gymAttended: true,
      photosCount: 0,
      waterMl: DIET_METRIC_THRESHOLDS.waterMl,
      sleepHours: DIET_METRIC_THRESHOLDS.sleepHours,
      stepCount: DIET_METRIC_THRESHOLDS.stepCount,
      hasWeeklyReview: false,
    });
    expect(r.attendance).toBe(30);
    expect(r.metricsHits).toBe(3);
    expect(r.total).toBe(30 + 20); // metrics 20 round
  });

  it("임계값 미달은 해당 metric 만 0", () => {
    const r = computeDietDailyScore({
      gymAttended: false,
      photosCount: 0,
      waterMl: DIET_METRIC_THRESHOLDS.waterMl - 1,
      sleepHours: DIET_METRIC_THRESHOLDS.sleepHours,
      stepCount: 0,
      hasWeeklyReview: false,
    });
    expect(r.metricsHits).toBe(1); // sleep 만 달성
  });

  it("photosCount 매우 큰 값도 캡 (초과 가산 없음)", () => {
    const r = computeDietDailyScore({
      gymAttended: false,
      photosCount: 99,
      waterMl: 0,
      sleepHours: 0,
      stepCount: 0,
      hasWeeklyReview: false,
    });
    expect(r.photoProof).toBe(DIET_SCORE_WEIGHTS.photoProof);
    expect(r.total).toBeLessThanOrEqual(100);
  });
});

describe("scoreFromLogRow", () => {
  it("log row 를 input 으로 변환해 동일 결과", () => {
    const row = {
      gym_attended: true,
      water_ml: 2000,
      sleep_hours: 7,
      step_count: 8000,
    };
    const r = scoreFromLogRow(row, 1, true);
    expect(r.total).toBe(100);
  });
});

describe("computeDietWeeklyScore", () => {
  it("7일 만점 평균 100", () => {
    expect(computeDietWeeklyScore([100, 100, 100, 100, 100, 100, 100])).toBe(
      100,
    );
  });
  it("일부 기록 없음은 0으로 채움", () => {
    // 승인 3일(각 100) + 4일 공란(0) = 300/7 ≈ 43
    expect(computeDietWeeklyScore([100, 100, 100])).toBe(43);
  });
  it("모두 공란이면 0", () => {
    expect(computeDietWeeklyScore([])).toBe(0);
  });
  it("8일 이상은 앞 7일만 사용", () => {
    expect(computeDietWeeklyScore([100, 100, 100, 100, 100, 100, 100, 0])).toBe(
      100,
    );
  });
});

describe("compute21DayCompletionRate", () => {
  it("21일 = 100%", () => {
    expect(compute21DayCompletionRate(21)).toBe(100);
  });
  it("10일 = 48% (반올림)", () => {
    expect(compute21DayCompletionRate(10)).toBe(48);
  });
  it("0일 = 0%", () => {
    expect(compute21DayCompletionRate(0)).toBe(0);
  });
  it("음수/초과는 clamp", () => {
    expect(compute21DayCompletionRate(-5)).toBe(0);
    expect(compute21DayCompletionRate(40)).toBe(100);
  });
});

describe("computeMissionCompletionRate", () => {
  it("모두 달성 → 100", () => {
    const missions = [
      { linkedHabitColumn: "protein_first" as const },
      { linkedHabitColumn: "gym_attended" as const },
    ];
    const responses = { protein_first: true, gym_attended: true };
    expect(computeMissionCompletionRate(missions, responses)).toBe(100);
  });
  it("절반 달성 → 50", () => {
    const missions = [
      { linkedHabitColumn: "protein_first" as const },
      { linkedHabitColumn: "gym_attended" as const },
    ];
    const responses = { protein_first: true, gym_attended: false };
    expect(computeMissionCompletionRate(missions, responses)).toBe(50);
  });
  it("linked 없는 미션만 있을 때 0", () => {
    expect(computeMissionCompletionRate([{}, {}], {})).toBe(0);
  });
  it("빈 배열 → 0", () => {
    expect(computeMissionCompletionRate([], {})).toBe(0);
  });
});

describe("isLogEmpty", () => {
  it("null row 는 empty", () => {
    expect(isLogEmpty(null)).toBe(true);
  });
  it("모든 필드 null/없음 → empty", () => {
    expect(isLogEmpty({})).toBe(true);
  });
  it("체크 한 개라도 있으면 not empty", () => {
    expect(isLogEmpty({ gym_attended: true })).toBe(false);
  });
  it("false 체크도 기록으로 간주", () => {
    expect(isLogEmpty({ protein_first: false })).toBe(false);
  });
  it("수치 기록 있으면 not empty", () => {
    expect(isLogEmpty({ water_ml: 500 })).toBe(false);
  });
  it("memo 공백만 있으면 empty", () => {
    expect(isLogEmpty({ memo: "   " })).toBe(true);
  });
  it("memo 실제 텍스트 있으면 not empty", () => {
    expect(isLogEmpty({ memo: "좋았음" })).toBe(false);
  });
});
