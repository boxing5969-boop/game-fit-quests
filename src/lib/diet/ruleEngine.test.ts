/**
 * 153 다이어트 — 규칙 엔진 단위 테스트.
 *
 * 중점 검증
 *   1. day → stage 경계 (1·7=reset, 8·14=burning, 15·21=lifestyle)
 *   2. 트랙별 미션 세트 반환 형태 및 중복 제거
 *   3. 청소년 트랙 안전 제약 (단식/거르기 키워드 배제)
 *   4. advanced 활성 조건 — 성인 + 코치 승인 + no-risk 모두 필요
 *   5. sanitizeTrackSelection 의 강제·하향·기본값
 *   6. computeDayIndex 경계 (시작 전/완주 후)
 *   7. computeHabitScore 0·100 경계
 */

import { describe, it, expect } from "vitest";

import {
  canActivateAdvanced,
  computeDayIndex,
  computeHabitScore,
  getDailyPlan,
  hasAnyRisk,
  sanitizeTrackSelection,
  type DietEligibilityContext,
} from "./ruleEngine";

const NO_RISK = {
  pregnancyBreastfeeding: false,
  diabetesMedication: false,
  eatingDisorderRisk: false,
  otherConditions: null,
} as const;

const BASE_ADULT_CTX: DietEligibilityContext = {
  isYouth: false,
  risk: { ...NO_RISK },
  coachApproved: false,
  consentAccepted: true,
};

// ──────────────────────────────────────────────────────────────────
// 1. stage 경계
// ──────────────────────────────────────────────────────────────────
describe("getDailyPlan — stage 경계", () => {
  it("day 1 은 reset 스테이지", () => {
    const p = getDailyPlan("adult_standard", 1);
    expect(p.stage).toBe("reset");
    expect(p.weekIndex).toBe(1);
  });
  it("day 7 은 reset 스테이지 마지막", () => {
    expect(getDailyPlan("adult_standard", 7).stage).toBe("reset");
  });
  it("day 8 은 burning 시작", () => {
    const p = getDailyPlan("adult_standard", 8);
    expect(p.stage).toBe("burning");
    expect(p.weekIndex).toBe(2);
  });
  it("day 14 는 burning 마지막", () => {
    expect(getDailyPlan("adult_standard", 14).stage).toBe("burning");
  });
  it("day 15 는 lifestyle 시작", () => {
    const p = getDailyPlan("adult_standard", 15);
    expect(p.stage).toBe("lifestyle");
    expect(p.weekIndex).toBe(3);
  });
  it("day 21 은 lifestyle 마지막", () => {
    expect(getDailyPlan("adult_standard", 21).stage).toBe("lifestyle");
  });
  it("day 0 이나 -1 은 day=1 로 clamp", () => {
    expect(getDailyPlan("adult_standard", 0).day).toBe(1);
    expect(getDailyPlan("adult_standard", -5).day).toBe(1);
  });
  it("day 22 이상은 21 로 clamp", () => {
    expect(getDailyPlan("adult_standard", 22).day).toBe(21);
    expect(getDailyPlan("adult_standard", 100).day).toBe(21);
  });
});

// ──────────────────────────────────────────────────────────────────
// 2. 트랙별 미션 반환 형태
// ──────────────────────────────────────────────────────────────────
describe("getDailyPlan — 트랙별 미션 세트", () => {
  it("adult_standard 는 미션을 최소 1개 이상 반환", () => {
    for (let d = 1; d <= 21; d++) {
      const plan = getDailyPlan("adult_standard", d);
      expect(plan.missions.length).toBeGreaterThan(0);
    }
  });

  it("youth_habit 은 모든 day 에서 미션 반환 + 중복 id 없음", () => {
    for (let d = 1; d <= 21; d++) {
      const plan = getDailyPlan("youth_habit", d);
      expect(plan.missions.length).toBeGreaterThan(0);
      const ids = plan.missions.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("adult_advanced_hidden 는 advanced focus 가 해당 day 에 포함", () => {
    const day10 = getDailyPlan("adult_advanced_hidden", 10);
    const has = day10.missions.some((m) => m.id.startsWith("aa-"));
    expect(has).toBe(true);
  });

  it("adult_standard 에는 advanced 전용 미션(aa-*)이 절대 포함되지 않음", () => {
    for (let d = 1; d <= 21; d++) {
      const plan = getDailyPlan("adult_standard", d);
      const advanced = plan.missions.filter((m) => m.id.startsWith("aa-"));
      expect(advanced).toHaveLength(0);
    }
  });

  it("plan.track 이 요청 트랙과 동일", () => {
    expect(getDailyPlan("youth_habit", 1).track).toBe("youth_habit");
    expect(getDailyPlan("adult_standard", 1).track).toBe("adult_standard");
    expect(getDailyPlan("adult_advanced_hidden", 1).track).toBe("adult_advanced_hidden");
  });
});

// ──────────────────────────────────────────────────────────────────
// 3. 청소년 트랙 안전 제약
// ──────────────────────────────────────────────────────────────────
describe("youth_habit 안전 제약 — 단식·거르기 언어 금지", () => {
  const FORBIDDEN = [
    "단식",
    "거르기",
    "굶",
    "식사 건너",
    "식사 스킵",
    "금식",
  ];
  it("모든 day 의 모든 미션 라벨·힌트에 금칙어 없음", () => {
    for (let d = 1; d <= 21; d++) {
      const plan = getDailyPlan("youth_habit", d);
      for (const m of plan.missions) {
        const blob = `${m.label} ${m.hint}`;
        for (const kw of FORBIDDEN) {
          expect(blob.includes(kw)).toBe(false);
        }
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// 4. advanced 활성 조건
// ──────────────────────────────────────────────────────────────────
describe("canActivateAdvanced — 활성 조건", () => {
  it("기본 성인 + 코치 승인 없음 → false", () => {
    expect(canActivateAdvanced(BASE_ADULT_CTX)).toBe(false);
  });

  it("성인 + 코치 승인 + no-risk + 동의 → true", () => {
    expect(
      canActivateAdvanced({ ...BASE_ADULT_CTX, coachApproved: true }),
    ).toBe(true);
  });

  it("청소년이면 어떤 조건이라도 false", () => {
    expect(
      canActivateAdvanced({
        ...BASE_ADULT_CTX,
        isYouth: true,
        coachApproved: true,
      }),
    ).toBe(false);
  });

  it("동의 미수락 → false", () => {
    expect(
      canActivateAdvanced({
        ...BASE_ADULT_CTX,
        coachApproved: true,
        consentAccepted: false,
      }),
    ).toBe(false);
  });

  it("위험요인 중 하나라도 true → false", () => {
    for (const key of [
      "pregnancyBreastfeeding",
      "diabetesMedication",
      "eatingDisorderRisk",
    ] as const) {
      expect(
        canActivateAdvanced({
          ...BASE_ADULT_CTX,
          coachApproved: true,
          risk: { ...NO_RISK, [key]: true },
        }),
      ).toBe(false);
    }
  });

  it("otherConditions 에 의미 있는 텍스트 있으면 false", () => {
    expect(
      canActivateAdvanced({
        ...BASE_ADULT_CTX,
        coachApproved: true,
        risk: { ...NO_RISK, otherConditions: "고혈압" },
      }),
    ).toBe(false);
  });

  it("otherConditions 가 공백 문자열이면 true (위험 아님)", () => {
    expect(
      canActivateAdvanced({
        ...BASE_ADULT_CTX,
        coachApproved: true,
        risk: { ...NO_RISK, otherConditions: "   " },
      }),
    ).toBe(true);
  });
});

describe("hasAnyRisk — 단독 검증", () => {
  it("모두 false + null → false", () => {
    expect(hasAnyRisk({ ...NO_RISK })).toBe(false);
  });
  it("pregnancy true → true", () => {
    expect(hasAnyRisk({ ...NO_RISK, pregnancyBreastfeeding: true })).toBe(true);
  });
  it("otherConditions 공백만 → false", () => {
    expect(hasAnyRisk({ ...NO_RISK, otherConditions: "" })).toBe(false);
    expect(hasAnyRisk({ ...NO_RISK, otherConditions: "\n\t  " })).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────
// 5. sanitizeTrackSelection
// ──────────────────────────────────────────────────────────────────
describe("sanitizeTrackSelection — 트랙 정합성 강제", () => {
  it("청소년은 무조건 youth_habit", () => {
    const ctx: DietEligibilityContext = { ...BASE_ADULT_CTX, isYouth: true };
    expect(sanitizeTrackSelection("adult_standard", ctx)).toBe("youth_habit");
    expect(sanitizeTrackSelection("adult_advanced_hidden", ctx)).toBe("youth_habit");
    expect(sanitizeTrackSelection(null, ctx)).toBe("youth_habit");
  });

  it("성인 null 입력 → adult_standard 기본값", () => {
    expect(sanitizeTrackSelection(null, BASE_ADULT_CTX)).toBe("adult_standard");
  });

  it("성인이 youth_habit 선택 시도 → adult_standard 로 하향", () => {
    expect(sanitizeTrackSelection("youth_habit", BASE_ADULT_CTX)).toBe(
      "adult_standard",
    );
  });

  it("성인이 advanced 요청했는데 코치 승인 없음 → adult_standard 하향", () => {
    expect(sanitizeTrackSelection("adult_advanced_hidden", BASE_ADULT_CTX)).toBe(
      "adult_standard",
    );
  });

  it("성인 + 코치 승인 + no-risk → advanced 유지", () => {
    const ctx: DietEligibilityContext = {
      ...BASE_ADULT_CTX,
      coachApproved: true,
    };
    expect(sanitizeTrackSelection("adult_advanced_hidden", ctx)).toBe(
      "adult_advanced_hidden",
    );
  });

  it("성인 + 코치 승인 + 임신 플래그 → adult_standard 로 하향", () => {
    const ctx: DietEligibilityContext = {
      ...BASE_ADULT_CTX,
      coachApproved: true,
      risk: { ...NO_RISK, pregnancyBreastfeeding: true },
    };
    expect(sanitizeTrackSelection("adult_advanced_hidden", ctx)).toBe(
      "adult_standard",
    );
  });
});

// ──────────────────────────────────────────────────────────────────
// 6. computeDayIndex
// ──────────────────────────────────────────────────────────────────
describe("computeDayIndex", () => {
  it("start_date 와 today 가 같으면 day 1", () => {
    const d = new Date(2026, 3, 22);
    expect(computeDayIndex(d, d)).toBe(1);
  });
  it("하루 뒤는 day 2", () => {
    const start = new Date(2026, 3, 22);
    const today = new Date(2026, 3, 23);
    expect(computeDayIndex(start, today)).toBe(2);
  });
  it("20일 뒤 = day 21", () => {
    const start = new Date(2026, 3, 1);
    const today = new Date(2026, 3, 21);
    expect(computeDayIndex(start, today)).toBe(21);
  });
  it("30일 뒤도 day 21 로 clamp", () => {
    const start = new Date(2026, 3, 1);
    const today = new Date(2026, 3, 30);
    expect(computeDayIndex(start, today)).toBe(21);
  });
  it("start_date 가 미래이면 day 1", () => {
    const start = new Date(2026, 4, 1);
    const today = new Date(2026, 3, 22);
    expect(computeDayIndex(start, today)).toBe(1);
  });
  it("잘못된 문자열은 day 1", () => {
    expect(computeDayIndex("not-a-date", new Date())).toBe(1);
  });
  it("ISO 문자열도 처리", () => {
    expect(computeDayIndex("2026-04-22", new Date(2026, 3, 22))).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// 7. computeHabitScore
// ──────────────────────────────────────────────────────────────────
describe("computeHabitScore", () => {
  it("응답 없음 → 0", () => {
    expect(computeHabitScore({})).toBe(0);
  });
  it("전부 true → 100", () => {
    expect(
      computeHabitScore({
        protein_first: true,
        veggies_natural: true,
        sugary_drink_avoided: true,
        late_night_snack_avoided: true,
        gym_attended: true,
      }),
    ).toBe(100);
  });
  it("3/5 → 60", () => {
    expect(
      computeHabitScore({
        protein_first: true,
        veggies_natural: true,
        sugary_drink_avoided: true,
        late_night_snack_avoided: false,
        gym_attended: null,
      }),
    ).toBe(60);
  });
  it("null 은 미응답으로 0 점", () => {
    expect(
      computeHabitScore({
        protein_first: null,
        veggies_natural: null,
        sugary_drink_avoided: null,
        late_night_snack_avoided: null,
        gym_attended: null,
      }),
    ).toBe(0);
  });
});
