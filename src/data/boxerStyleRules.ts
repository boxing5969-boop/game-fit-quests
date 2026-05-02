/**
 * 153 QUEST v1.5 17단계 — 복서 스타일 진단 순수 함수.
 *
 * 6 스타일: speed_fighter / power_puncher / technician /
 *           endurance_boxer / guard_master / second_leader
 *
 * 보호 원칙 (§11-⑦):
 *   · BoxerStyleInput 타입에 member_progress / total_xp / current_level
 *     필드를 의도적으로 부재시킴. 점수 함수가 공식 데이터에 절대 접근 불가.
 *   · 표시용 컨텍스트(현재 리그·레벨)는 별도 displayContext 인자로 분리.
 *   · 본 모듈은 입출력 모두 TypeScript 타입 — DB 호출 0건.
 */

import type {
  BoxingConditionLogRow,
  FunChallengeCategory,
} from "@/services/boxingEngagementService";

export type BoxerStyle =
  | "speed_fighter"
  | "power_puncher"
  | "technician"
  | "endurance_boxer"
  | "guard_master"
  | "second_leader";

/** 데이터 부족 시 표시 (분석 진행 중) */
export const ROOKIE_UNDER_ANALYSIS = "rookie_under_analysis" as const;

export type BoxerStyleResultKey = BoxerStyle | typeof ROOKIE_UNDER_ANALYSIS;

export interface BoxerStyleProfileInput {
  quiz_correct_count: number;
  quiz_attempt_count: number;
  challenge_clear_count: number;
  cheer_sent_count: number;
  cheer_received_count: number;
  journal_count: number;
  current_quiz_streak: number;
  best_quiz_streak: number;
}

export interface BoxerStyleChallengeAttemptInput {
  category: FunChallengeCategory;
  status: string;
}

export interface BoxerStyleConditionInput {
  condition_type: BoxingConditionLogRow["condition_type"];
}

export interface BoxerStyleHiddenClaimInput {
  code: string;
}

/**
 * ⚠ 본 input 인터페이스에 member_progress / total_xp / current_level 등
 * 공식 데이터를 절대 추가하지 마라 (§11-⑦).
 */
export interface BoxerStyleInput {
  profile: BoxerStyleProfileInput;
  challengeAttempts: BoxerStyleChallengeAttemptInput[];
  conditionLogs: BoxerStyleConditionInput[];
  hiddenMissionClaims: BoxerStyleHiddenClaimInput[];
}

/** 표시 전용 — 점수 계산에 들어가서는 안 된다. */
export interface BoxerStyleDisplayContext {
  currentRank?: string;
  currentLevel?: number;
}

export interface BoxerStyleDiagnosis {
  primaryStyle: BoxerStyleResultKey;
  secondaryStyle: BoxerStyle | null;
  confidence: number;
  reason: string;
  nextSuggestion: string;
  scores: Record<BoxerStyle, number>;
}

export interface BoxerStyleMetadata {
  key: BoxerStyleResultKey;
  emoji: string;
  label: string;
  shortDescription: string;
  longDescription: string;
}

export const BOXER_STYLE_METADATA: Record<
  BoxerStyleResultKey,
  BoxerStyleMetadata
> = {
  speed_fighter: {
    key: "speed_fighter",
    emoji: "⚡️",
    label: "스피드 파이터",
    shortDescription: "잽·풋워크·줄넘기 비중이 높은 빠른 복서.",
    longDescription:
      "거리 조절과 빠른 잽이 강점입니다. 짧은 라운드에 강하고, 회복 능력도 우수합니다.",
  },
  power_puncher: {
    key: "power_puncher",
    emoji: "💥",
    label: "파워 펀처",
    shortDescription: "샌드백·푸시업·원투 비중이 높은 강한 복서.",
    longDescription:
      "한 방의 힘이 강합니다. 다만 페이스 조절과 회복도 같이 챙기면 더 멀리 갑니다.",
  },
  technician: {
    key: "technician",
    emoji: "🧠",
    label: "테크니션",
    shortDescription: "복싱 IQ + 콤보 챌린지 비중이 높은 머리로 치는 복서.",
    longDescription:
      "퀴즈 정답률과 콤보 정밀도가 강점입니다. 알고 치는 펀치는 더 강합니다.",
  },
  endurance_boxer: {
    key: "endurance_boxer",
    emoji: "🛡",
    label: "인내형 복서",
    shortDescription: "꾸준함과 누적 기록이 강점인 복서.",
    longDescription:
      "출석·챌린지 반복·일기 누적에서 두드러집니다. 결국 마지막 라운드를 가져가는 타입.",
  },
  guard_master: {
    key: "guard_master",
    emoji: "🦾",
    label: "가드 마스터",
    shortDescription: "안전·방어·통증 점검이 성실한 복서.",
    longDescription:
      "통증 체크 / 가드 챌린지 / 회복 루틴을 빼먹지 않습니다. 부상 없이 오래 가는 비결.",
  },
  second_leader: {
    key: "second_leader",
    emoji: "🎖",
    label: "세컨드형 리더",
    shortDescription: "응원·RP·동료 활동 비중이 높은 리더형 복서.",
    longDescription:
      "코너에서 동료를 일으켜 세웁니다. 응원도 실력입니다.",
  },
  rookie_under_analysis: {
    key: "rookie_under_analysis",
    emoji: "🥚",
    label: "루키 — 분석 중",
    shortDescription: "데이터가 충분히 모이면 스타일이 보입니다.",
    longDescription:
      "퀴즈, 챌린지, 일기, 응원을 조금만 더 해보면 곧 첫 스타일이 진단됩니다.",
  },
};

/** 챌린지 카테고리 → 스타일 가중치 */
const CHALLENGE_CATEGORY_WEIGHTS: Record<FunChallengeCategory, Partial<Record<BoxerStyle, number>>> = {
  jab:        { speed_fighter: 3, technician: 1 },
  one_two:    { power_puncher: 2, technician: 1 },
  squat:      { power_puncher: 2, endurance_boxer: 1 },
  pushup:     { power_puncher: 3 },
  sandbag:    { power_puncher: 3 },
  jump_rope:  { speed_fighter: 3, endurance_boxer: 1 },
  guard:      { guard_master: 4 },
  combo:      { technician: 3, speed_fighter: 1 },
  community:  { second_leader: 3 },
  recovery:   { guard_master: 2, endurance_boxer: 1 },
};

const ZERO_SCORES: Record<BoxerStyle, number> = {
  speed_fighter: 0,
  power_puncher: 0,
  technician: 0,
  endurance_boxer: 0,
  guard_master: 0,
  second_leader: 0,
};

const ROOKIE_THRESHOLD = 5;

/**
 * 회원 활동 데이터로부터 복서 스타일 점수 계산.
 *
 * ⚠ input 에 공식 member_progress 가 부재해야 한다 — TypeScript 타입으로 차단.
 */
export function computeBoxerStyleDiagnosis(
  input: BoxerStyleInput,
): BoxerStyleDiagnosis {
  const scores: Record<BoxerStyle, number> = { ...ZERO_SCORES };

  const totalActivity =
    input.profile.quiz_attempt_count +
    input.profile.challenge_clear_count +
    input.profile.cheer_sent_count +
    input.profile.journal_count +
    input.conditionLogs.length;

  // 루키 분기 — 활동량이 너무 적으면 분석 중
  if (totalActivity < ROOKIE_THRESHOLD) {
    return {
      primaryStyle: "rookie_under_analysis",
      secondaryStyle: null,
      confidence: 0,
      reason:
        "퀴즈·챌린지·일기·응원이 조금만 더 모이면 첫 스타일을 진단할 수 있습니다.",
      nextSuggestion:
        "오늘은 복싱 IQ 1문제 + 챔피언 일기 1줄로 시작해보세요.",
      scores,
    };
  }

  // === 1. 퀴즈 (테크니션 가중)
  scores.technician += input.profile.quiz_correct_count * 1.2;
  scores.technician += input.profile.best_quiz_streak * 1.5;

  // === 2. 챌린지 클리어 (카테고리 가중치 합산)
  for (const att of input.challengeAttempts) {
    if (att.status !== "completed") continue;
    const w = CHALLENGE_CATEGORY_WEIGHTS[att.category];
    if (!w) continue;
    for (const [style, weight] of Object.entries(w)) {
      scores[style as BoxerStyle] += weight ?? 0;
    }
  }

  // === 3. 일기 누적 (인내형)
  scores.endurance_boxer += input.profile.journal_count * 0.8;

  // === 4. 응원 (세컨드형 리더)
  scores.second_leader += input.profile.cheer_sent_count * 0.8;
  scores.second_leader += input.profile.cheer_received_count * 0.3;

  // === 5. 컨디션 기록 (가드 마스터)
  scores.guard_master += input.conditionLogs.length * 0.6;
  // pain 기록을 솔직히 한 사람은 자기 점검 우수 → 가드 가산
  for (const c of input.conditionLogs) {
    if (c.condition_type === "pain") scores.guard_master += 1.5;
  }

  // === 6. 숨겨진 미션 (분야별 보너스)
  for (const h of input.hiddenMissionClaims) {
    if (h.code === "first_cheer" || h.code === "respect_30") {
      scores.second_leader += 5;
    } else if (h.code === "quiz_streak_3") {
      scores.technician += 5;
    } else if (h.code === "journal_7") {
      scores.endurance_boxer += 5;
    } else if (h.code === "challenge_5") {
      scores.power_puncher += 3;
      scores.endurance_boxer += 2;
    } else if (h.code === "balanced_boxer") {
      // 균형 — 모든 스타일에 약간 가산 (편향 방지)
      for (const k of Object.keys(scores) as BoxerStyle[]) {
        scores[k] += 1;
      }
    } else if (h.code === "condition_7") {
      scores.guard_master += 5;
    } else if (h.code === "comeback_record") {
      scores.endurance_boxer += 3;
    }
  }

  // === 정렬
  const sorted = (Object.entries(scores) as Array<[BoxerStyle, number]>)
    .sort((a, b) => b[1] - a[1]);

  const [primary, primaryScore] = sorted[0];
  const [secondary, secondaryScore] = sorted[1];

  const totalScore = sorted.reduce((sum, [, s]) => sum + s, 0);
  const confidence =
    totalScore > 0 ? Math.round((primaryScore / totalScore) * 100) : 0;

  const reason = buildReason(primary, input);
  const nextSuggestion = buildNextSuggestion(primary);

  return {
    primaryStyle: primary,
    secondaryStyle:
      secondaryScore > 0 && secondary !== primary ? secondary : null,
    confidence,
    reason,
    nextSuggestion,
    scores,
  };
}

function buildReason(style: BoxerStyle, input: BoxerStyleInput): string {
  switch (style) {
    case "speed_fighter":
      return "잽·줄넘기·콤보 비중이 높은 빠른 복서로 분석됩니다.";
    case "power_puncher":
      return "샌드백·푸시업·원투 같은 파워 계열 챌린지 비중이 높습니다.";
    case "technician":
      return `퀴즈 정답률이 강점입니다 (정답 ${input.profile.quiz_correct_count}회, 최고 연속 ${input.profile.best_quiz_streak}회).`;
    case "endurance_boxer":
      return `꾸준함과 누적 기록이 두드러집니다 (일기 ${input.profile.journal_count}회).`;
    case "guard_master":
      return `통증 체크 / 컨디션 기록 / 회복 루틴을 성실히 챙기고 있습니다.`;
    case "second_leader":
      return `응원 활동이 두드러집니다 (보낸 응원 ${input.profile.cheer_sent_count}회).`;
  }
}

function buildNextSuggestion(style: BoxerStyle): string {
  switch (style) {
    case "speed_fighter":
      return "다음은 콤보 챌린지로 정밀도까지 챙겨보세요.";
    case "power_puncher":
      return "회복 루틴과 가드 챌린지도 같이 들어가면 더 멀리 갑니다.";
    case "technician":
      return "이번 주는 도전형 챌린지에 도전해보세요. 머리 + 몸 합쳐서.";
    case "endurance_boxer":
      return "오늘은 새로운 카테고리의 챌린지를 한 번 시도해보세요.";
    case "guard_master":
      return "충분히 회복하면서 도전형 챌린지에도 천천히 진입해보세요.";
    case "second_leader":
      return "동료 응원에 더해, 본인의 챌린지·퀴즈도 같이 챙기면 균형이 잡힙니다.";
  }
}
