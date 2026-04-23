/**
 * 153 다이어트 · 21일 종료 후 경로 추천 엔진.
 *
 * 서버(`ensure_post_program_plan`)는 승인 일수만으로 초안을 내고,
 * 클라이언트에서 최근 7일 수행률·자기보고·코치 평가를 조합해 최종 추천을 낸다.
 *
 * 결과는 3가지 중 하나:
 *   - maintenance : 유지 컨설팅 모드 권장
 *   - extend      : 건강리셋 연장 프로그램 권장
 *   - either      : 두 경로 다 가능 — 코치 상담 권장
 *
 * 톤: "실패/성공" 이분법 금지. 이유 문구도 중립적으로.
 */

import type {
  DietPostProgramRecommendation,
  DietPostProgramSummary,
} from "./postProgramTypes";

export interface RecommendInput {
  summary: DietPostProgramSummary;
  targetAchieved: boolean | null;            // 자기보고 (null = 미응답)
  recentAdherence7d: number | null;          // 최근 7일 수행률 % (null 허용)
  lateBingeCount7d: number | null;           // 최근 7일 늦은 폭식 횟수
  sugaryDrinkCount7d: number | null;         // 최근 7일 당 음료 횟수
  attendanceStable: boolean | null;          // 주 3회 이상 출석 여부
  coachRecommendation: DietPostProgramRecommendation | null;
}

export interface RecommendResult {
  path: DietPostProgramRecommendation;
  reasons: string[];
  confidence: "high" | "medium" | "low";
}

/**
 * 규칙 기반 가중치.
 *
 * maintenance 쪽으로 기울이는 신호:
 *   + 목표 달성
 *   + 승인 일수 ≥ 18
 *   + 최근 7일 수행률 ≥ 80
 *   + 늦은 폭식·당 음료 거의 없음
 *   + 출석 안정
 *   + 코치가 maintenance 권장
 *
 * extend 쪽으로 기울이는 신호:
 *   + 목표 미달성
 *   + 승인 일수 < 18 (특히 < 14)
 *   + 최근 7일 수행률 < 60
 *   + 늦은 폭식 / 당 음료 빈번
 *   + 출석 불안정
 *   + 코치가 extend 권장
 */
export function recommendPath(input: RecommendInput): RecommendResult {
  const reasons: string[] = [];
  let maintScore = 0;
  let extendScore = 0;
  let strongSignals = 0;

  const { summary } = input;

  // 1. 자기보고 목표 달성
  if (input.targetAchieved === true) {
    maintScore += 3;
    strongSignals++;
    reasons.push("목표 체중에 도달했습니다");
  } else if (input.targetAchieved === false) {
    extendScore += 3;
    strongSignals++;
    reasons.push("아직 목표에 도달하지 않았습니다");
  }

  // 2. 21일 승인 일수
  if (summary.approved_days >= 18) {
    maintScore += 2;
    reasons.push(`21일 중 ${summary.approved_days}일 체크인 승인 — 습관이 자리잡았습니다`);
  } else if (summary.approved_days >= 14) {
    maintScore += 1;
    extendScore += 1;
    reasons.push(`21일 중 ${summary.approved_days}일 체크인 — 안정화 단계에 있습니다`);
  } else {
    extendScore += 2;
    reasons.push(`21일 중 ${summary.approved_days}일 체크인 — 리듬을 더 다지는 게 좋습니다`);
  }

  // 3. 최근 7일 수행률
  if (input.recentAdherence7d !== null) {
    if (input.recentAdherence7d >= 80) {
      maintScore += 2;
      reasons.push(`최근 일주일 수행률 ${Math.round(input.recentAdherence7d)}%`);
    } else if (input.recentAdherence7d < 60) {
      extendScore += 2;
      reasons.push(`최근 일주일 수행률이 낮은 편입니다`);
    }
  }

  // 4. 늦은 폭식 빈도
  if (input.lateBingeCount7d !== null) {
    if (input.lateBingeCount7d <= 1) {
      maintScore += 1;
    } else if (input.lateBingeCount7d >= 3) {
      extendScore += 2;
      reasons.push("늦은 시간 폭식이 반복되었습니다");
    }
  }

  // 5. 당 음료 빈도
  if (input.sugaryDrinkCount7d !== null) {
    if (input.sugaryDrinkCount7d <= 1) {
      maintScore += 1;
    } else if (input.sugaryDrinkCount7d >= 4) {
      extendScore += 1;
    }
  }

  // 6. 출석 안정성
  if (input.attendanceStable === true) {
    maintScore += 1;
  } else if (input.attendanceStable === false) {
    extendScore += 1;
  }

  // 7. 코치 권장 — 강한 가중치
  if (input.coachRecommendation === "maintenance") {
    maintScore += 3;
    strongSignals++;
    reasons.push("코치가 유지 모드를 권장합니다");
  } else if (input.coachRecommendation === "extend") {
    extendScore += 3;
    strongSignals++;
    reasons.push("코치가 건강리셋 연장을 권장합니다");
  } else if (input.coachRecommendation === "either") {
    reasons.push("코치가 두 경로 모두 가능하다고 판단했습니다");
  }

  // 결과 결정
  const gap = Math.abs(maintScore - extendScore);
  let path: DietPostProgramRecommendation;
  if (gap <= 1) {
    path = "either";
  } else {
    path = maintScore > extendScore ? "maintenance" : "extend";
  }

  // 신뢰도: 강한 신호 개수 + 점수 차
  const confidence: RecommendResult["confidence"] =
    strongSignals >= 2 && gap >= 3
      ? "high"
      : strongSignals >= 1 && gap >= 2
        ? "medium"
        : "low";

  return { path, reasons: reasons.slice(0, 4), confidence };
}

/** 추천 결과 → 한글 라벨. */
export function recommendationLabel(path: DietPostProgramRecommendation): string {
  switch (path) {
    case "maintenance":
      return "유지 컨설팅 모드";
    case "extend":
      return "건강리셋 연장 프로그램";
    case "either":
      return "코치 상담 권장";
  }
}
