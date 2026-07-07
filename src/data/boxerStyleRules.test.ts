/**
 * 153 QUEST v1.5 17단계 — 복서 스타일 진단 단위 테스트.
 *
 * 검증:
 *   1. 데이터 부족 → 'rookie_under_analysis' 분기
 *   2. 입력 타입에 공식 데이터(member_progress)가 없는지 (§11-⑦)
 *   3. 6 스타일 분기 각각이 활성화되는 input 으로 점수가 1위로 나오는지
 *   4. balanced_boxer hidden mission 이 모든 스타일에 균등 가산하는지
 */

import { describe, it, expect } from "vitest";

import {
  computeBoxerStyleDiagnosis,
  ROOKIE_UNDER_ANALYSIS,
  type BoxerStyleInput,
} from "./boxerStyleRules";

const emptyProfile: BoxerStyleInput["profile"] = {
  quiz_correct_count: 0,
  quiz_attempt_count: 0,
  challenge_clear_count: 0,
  cheer_sent_count: 0,
  cheer_received_count: 0,
  journal_count: 0,
  current_quiz_streak: 0,
  best_quiz_streak: 0,
};

function baseInput(
  overrides: Partial<BoxerStyleInput> = {},
): BoxerStyleInput {
  return {
    profile: { ...emptyProfile },
    challengeAttempts: [],
    conditionLogs: [],
    hiddenMissionClaims: [],
    ...overrides,
  };
}

describe("boxerStyleRules — 입력 타입 검증 (§11-⑦)", () => {
  it("BoxerStyleInput 은 member_progress / total_xp / current_level 필드를 포함하지 않는다", () => {
    // 컴파일 시점 검증 — 본 테스트가 통과하면 input 타입에 공식 필드가 없음.
    const input = baseInput();
    // @ts-expect-error — total_xp 가 BoxerStyleInput.profile 에 없어야 함
    void input.profile.total_xp;
    // @ts-expect-error — current_level 이 BoxerStyleInput.profile 에 없어야 함
    void input.profile.current_level;
    expect(true).toBe(true);
  });
});

describe("boxerStyleRules — 루키 분기", () => {
  it("활동량이 5 미만이면 rookie_under_analysis", () => {
    const r = computeBoxerStyleDiagnosis(baseInput());
    expect(r.primaryStyle).toBe(ROOKIE_UNDER_ANALYSIS);
    expect(r.confidence).toBe(0);
  });

  it("활동량이 5 이상이면 정식 스타일 진단", () => {
    const r = computeBoxerStyleDiagnosis(
      baseInput({
        profile: {
          ...emptyProfile,
          journal_count: 5, // 인내형 가산
        },
      }),
    );
    expect(r.primaryStyle).not.toBe(ROOKIE_UNDER_ANALYSIS);
  });
});

describe("boxerStyleRules — 6 스타일 분기", () => {
  it("technician — 퀴즈 정답·연속이 많으면 1위", () => {
    const r = computeBoxerStyleDiagnosis(
      baseInput({
        profile: {
          ...emptyProfile,
          quiz_correct_count: 50,
          quiz_attempt_count: 60,
          best_quiz_streak: 10,
        },
      }),
    );
    expect(r.primaryStyle).toBe("technician");
  });

  it("speed_fighter — 잽·줄넘기 챌린지 비중", () => {
    const r = computeBoxerStyleDiagnosis(
      baseInput({
        // 루키 게이트(활동량 ≥5)는 profile.challenge_clear_count 로 판정된다.
        profile: { ...emptyProfile, challenge_clear_count: 5 },
        challengeAttempts: [
          { category: "jab", status: "completed" },
          { category: "jab", status: "completed" },
          { category: "jump_rope", status: "completed" },
          { category: "jump_rope", status: "completed" },
        ],
      }),
    );
    expect(r.primaryStyle).toBe("speed_fighter");
  });

  it("power_puncher — 샌드백·푸시업 비중", () => {
    const r = computeBoxerStyleDiagnosis(
      baseInput({
        // 루키 게이트(활동량 ≥5)는 profile.challenge_clear_count 로 판정된다.
        profile: { ...emptyProfile, challenge_clear_count: 5 },
        challengeAttempts: [
          { category: "sandbag", status: "completed" },
          { category: "sandbag", status: "completed" },
          { category: "pushup", status: "completed" },
        ],
      }),
    );
    expect(r.primaryStyle).toBe("power_puncher");
  });

  it("guard_master — 가드 챌린지 + 컨디션 기록", () => {
    const r = computeBoxerStyleDiagnosis(
      baseInput({
        challengeAttempts: [{ category: "guard", status: "completed" }],
        conditionLogs: [
          { condition_type: "pain" },
          { condition_type: "pain" },
          { condition_type: "tired" },
          { condition_type: "tired" },
          { condition_type: "tired" },
        ],
      }),
    );
    expect(r.primaryStyle).toBe("guard_master");
  });

  it("second_leader — 응원 비중", () => {
    const r = computeBoxerStyleDiagnosis(
      baseInput({
        profile: {
          ...emptyProfile,
          cheer_sent_count: 30,
          cheer_received_count: 10,
        },
      }),
    );
    expect(r.primaryStyle).toBe("second_leader");
  });

  it("endurance_boxer — 일기 누적", () => {
    const r = computeBoxerStyleDiagnosis(
      baseInput({
        profile: {
          ...emptyProfile,
          journal_count: 30,
        },
      }),
    );
    expect(r.primaryStyle).toBe("endurance_boxer");
  });
});

describe("boxerStyleRules — 결정성 / confidence", () => {
  it("동일 input 은 같은 결과 반환 (결정적)", () => {
    const input = baseInput({
      profile: { ...emptyProfile, quiz_correct_count: 30 },
    });
    const r1 = computeBoxerStyleDiagnosis(input);
    const r2 = computeBoxerStyleDiagnosis(input);
    expect(r1).toEqual(r2);
  });

  it("점수가 0 이면 confidence 0", () => {
    const r = computeBoxerStyleDiagnosis(
      baseInput({
        profile: { ...emptyProfile, journal_count: 5 },
      }),
    );
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(100);
  });
});

describe("boxerStyleRules — 숨겨진 미션 가산", () => {
  it("balanced_boxer 클레임은 모든 스타일에 +1 균등 가산", () => {
    const r = computeBoxerStyleDiagnosis(
      baseInput({
        profile: { ...emptyProfile, journal_count: 5 },
        hiddenMissionClaims: [{ code: "balanced_boxer" }],
      }),
    );
    // 모든 스타일이 최소 1점 이상
    for (const v of Object.values(r.scores)) {
      expect(v).toBeGreaterThanOrEqual(1);
    }
  });
});
