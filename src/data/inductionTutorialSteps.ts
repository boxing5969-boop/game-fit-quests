/**
 * "랭킹업 입단식" — induction tutorial step config.
 *
 * Single source of truth for the 5-step induction flow. Kept separate
 * from `unlockRules.ts` TUTORIAL_STEPS (which powers the legacy
 * TutorialOverlay) so the new flow can evolve without disturbing
 * existing call sites.
 *
 * Reward amounts MUST stay in sync with the server RPC
 * `public.tutorial_step_reward_amount` — mirrored here for optimistic
 * UI and totals. Sum = 1000 (== total reward paid by server).
 *
 * ──────────────────────────────────────────────────────────────────
 * 가치 전달 필드 (확장)
 * ──────────────────────────────────────────────────────────────────
 * 5-act 내러티브 (출발점 → 위치 → 오늘 → 증명 → 첫 한 줄) 에 맞춰
 * 각 step 의 카피/가치/근거를 모두 이 파일에서 관리한다. UI 컴포넌트는
 * 텍스트를 하드코딩하지 않고 step.* 만 읽는다.
 *   · valueHeadline : 한 줄 헤드라인 (가치 선언)
 *   · valueBody     : 1~2 줄 본문 (왜 이 화면이 중요한지)
 *   · whyItMatters  : 코칭 톤 한 줄 (CoachBot 대사 폴백·요약)
 *   · coachMessage  : 오삼 코치 대사 (멀티라인, \n 허용)
 *   · ctaLabel      : 메인 CTA 문구
 *   · shortLabel    : ProgressBar / 분석 이벤트용 짧은 라벨
 *   · proofItems    : 화면에 표시할 실데이터 키 (UI 가 매핑해 렌더)
 */

export type InductionStepId =
  | "profile"        // 1. 출발점 — 내 카드가 0일차
  | "ranking"        // 2. 나의 위치 — 리그/레벨/1단 도전
  | "quest"          // 3. 오늘의 훈련 — 출석 ≠ 성장
  | "rewards"        // 4. 증명과 보상 — 코치 검증 + 부가 혜택
  | "first_action";  // 5. 첫 한 줄 — 첫 기록이 출발

/**
 * proofItems 키 — UI 가 실제 데이터를 매핑해 렌더할 식별자.
 * 신규 데이터 호출은 추가하지 않고, 기존 훅(profile / questData / progress) 만 재사용.
 */
export type InductionProofKey =
  | "current_league"            // profile.current_rank
  | "current_level"             // profile.current_level
  | "next_level_progress"       // useLocalProgress XP %
  | "league_roadmap"            // 백→청→적→흑 단계 시각화 (정적)
  | "first_dan_unlock"          // 10레벨 1단 심사 안내 (정적)
  | "today_mission_count"       // useQuestData 오늘 미션 수
  | "today_mission_preview"     // useQuestData 첫 1~2개 미리보기
  | "rewards_preview"           // 단증 혜택 정적 카드
  | "coach_review_note"         // "코치가 주기적으로 검토" 정적 안내
  | "first_record_callout";     // 첫 기록 0일차 강조

export interface InductionStep {
  /** 1..5 — server-side `tutorial_step` value after this step finishes. */
  order: 1 | 2 | 3 | 4 | 5;
  id: InductionStepId;
  /** 카드 메인 제목 (한 줄, ~12자). */
  title: string;
  /** 진행바·분석 라벨용 짧은 이름 (≤ 6자). */
  shortLabel: string;
  /** 가치 헤드라인 — 카드 부제목으로 노출. */
  valueHeadline: string;
  /** 1~2 줄 본문. 왜 이 화면이 중요한지. */
  valueBody: string;
  /** 코치 페르소나 한 줄 요약 (CoachBot 폴백). */
  whyItMatters: string;
  /** 오삼 코치 멀티라인 대사 — \n 으로 줄바꿈. */
  coachMessage: string;
  /** 주 CTA 문구. */
  ctaLabel: string;
  /** 화면에 표시할 실데이터 proof 키 배열 (UI 매핑). */
  proofItems: readonly InductionProofKey[];
  /** 종전 description — 호환을 위해 유지 (= valueBody). */
  description: string;
  /** Route the user should visit while this step is active (UI hint). */
  navTarget?: string;
  /** Mirrors server `tutorial_step_reward_amount(order)`. */
  rewardGems: number;
}

export const INDUCTION_STEPS: readonly InductionStep[] = Object.freeze([
  {
    order: 1,
    id: "profile",
    title: "출발점",
    shortLabel: "출발",
    // 가치 1: 이 앱은 단순 출석앱이 아니다
    valueHeadline: "출석앱이 아니라 성장 기록 시스템",
    valueBody:
      "153 은 와서 체크만 찍는 앱이 아닙니다. 매번의 훈련이 한 사람의 성장 기록으로 남고, 그 기록이 리그·레벨·단증으로 이어집니다.",
    whyItMatters:
      "오늘부터 당신의 모든 운동은 사라지지 않고 성장 기록으로 쌓입니다.",
    coachMessage:
      "153 은 출석이 아니라 성장으로 증명하는 곳입니다.\n지금의 당신이 출발점이에요.",
    ctaLabel: "내 출발점 확인",
    proofItems: ["first_record_callout"] as const,
    description:
      "내 복서 카드를 확인합니다. 이름·현재 상태가 모든 기록의 기준이 됩니다.",
    navTarget: "/mypage",
    rewardGems: 100,
  },
  {
    order: 2,
    id: "ranking",
    title: "나의 위치",
    shortLabel: "위치",
    // 가치 4: 리그와 레벨은 내 위치와 목표를 명확하게 만든다
    // 가치 5: 10레벨 이후에는 1단 도전이라는 실제 목표가 열린다
    valueHeadline: "내 위치가 보이면 다음이 분명해집니다",
    valueBody:
      "백·청·적·흑 4단계 리그 + 각 10레벨. 흑색 Lv.10 을 넘으면 1단 심사라는 실제 목표가 열립니다. 더 이상 '열심히' 가 아니라 '어디까지' 가 보입니다.",
    whyItMatters:
      "리그·레벨은 내 위치와 다음 목표를 분명하게 만들고, 그 끝에는 1단 도전이 있습니다.",
    coachMessage:
      "백·청·적·흑을 지나 1단 심사까지 — 정해진 길이 있습니다.\n오늘의 한 발이 그 길의 일부예요.",
    ctaLabel: "나의 리그 보기",
    proofItems: [
      "current_league",
      "current_level",
      "league_roadmap",
      "first_dan_unlock",
    ] as const,
    description:
      "백 → 청 → 적 → 흑 단계적 성장 구조. 현재 리그·레벨이 다음 승급 목표가 됩니다.",
    navTarget: "/halloffame",
    rewardGems: 100,
  },
  {
    order: 3,
    id: "quest",
    title: "오늘의 훈련",
    shortLabel: "훈련",
    // 가치 2: 오늘의 훈련은 다음 레벨과 승급에 직접 연결된다
    valueHeadline: "오늘의 훈련 = 다음 레벨의 연료",
    valueBody:
      "오늘 완료한 훈련은 바로 XP 로 쌓이고, 쌓인 XP 는 레벨업과 승급 조건을 만듭니다. '열심히 했다' 가 아니라 '어디까지 왔다' 가 남습니다.",
    whyItMatters:
      "오늘의 훈련 한 줄이 다음 레벨·리그 승급에 직접 연결됩니다.",
    coachMessage:
      "오늘의 훈련 한 줄이 XP 가 되고,\nXP 가 다음 레벨과 승급을 만듭니다.",
    ctaLabel: "오늘의 훈련 보기",
    proofItems: [
      "today_mission_count",
      "today_mission_preview",
      "next_level_progress",
    ] as const,
    description:
      "복싱·자세·습관 — 오늘 해야 할 훈련이 준비돼 있습니다. 매일의 한 줄이 다음 단증의 근거가 됩니다.",
    navTarget: "/missions",
    rewardGems: 200,
  },
  {
    order: 4,
    id: "rewards",
    title: "증명과 보상",
    shortLabel: "증명",
    // 가치 3: 내 성장은 기록과 코치 기준으로 증명된다
    valueHeadline: "코치의 기준 + 기록으로 증명",
    valueBody:
      "153 의 레벨업·승급·단증은 자의적 통과가 아닙니다. 코치의 공식 기준을 통과해야 인정됩니다. 당신의 성장은 기록과 코치 평가라는 이중 근거로 증명돼요.",
    whyItMatters:
      "성장은 기록과 코치 기준 두 가지로 증명됩니다. 보상은 그 증거의 부산물입니다.",
    coachMessage:
      "자의적 인정이 아니라 기록 + 코치 기준.\n이 이중 증명이 153 의 단증을 특별하게 만듭니다.",
    ctaLabel: "보상과 혜택 둘러보기",
    proofItems: ["coach_review_note", "rewards_preview"] as const,
    description:
      "훈련 완수 시 파이트 머니가 지급됩니다. 복서 카드 장식·단증 혜택 등 실제 가치로 연결됩니다.",
    navTarget: "/rewards",
    rewardGems: 200,
  },
  {
    order: 5,
    id: "first_action",
    title: "첫 한 줄",
    shortLabel: "첫 기록",
    // 가치 5: 10레벨 이후에는 1단 도전이라는 실제 목표가 열린다
    // + 가치 전체 회수: 5개 메시지를 한 번에 닫는 클로저
    valueHeadline: "오늘 한 줄이 1단까지의 첫 발",
    valueBody:
      "오늘의 훈련 중 하나를 시작합니다. 이 첫 기록이 0일차 · 레벨업의 첫 XP · 리그 승급의 첫 근거 · 그리고 1단 심사까지의 첫 발이 됩니다.",
    whyItMatters:
      "지금 한 번의 시작이 1단 심사대까지 이어지는 첫 발입니다.",
    coachMessage:
      "마지막 단계 — 오늘의 훈련 하나만 시작해 주세요.\n이 첫 한 줄이 1단 도전까지의 시작점이에요.",
    ctaLabel: "첫 한 줄 남기기",
    proofItems: ["today_mission_preview", "first_record_callout"] as const,
    description:
      "오늘의 훈련 중 하나를 골라 시작합니다. 첫 기록부터 당신의 성장이 측정되기 시작합니다.",
    // Step 5 는 미션 페이지에서 마무리 — finish RPC + 축하 카드 → 같은 페이지에서 시작.
    navTarget: "/missions",
    rewardGems: 400,
  },
] as const);

export const INDUCTION_TOTAL_STEPS = INDUCTION_STEPS.length; // 5
export const INDUCTION_TOTAL_REWARD = INDUCTION_STEPS.reduce(
  (sum, s) => sum + s.rewardGems,
  0,
); // 1000

/** Map 1-based order to config entry (throws on invalid to surface bugs early). */
export function getInductionStep(order: number): InductionStep {
  const step = INDUCTION_STEPS.find((s) => s.order === order);
  if (!step) throw new Error(`invalid induction step order: ${order}`);
  return step;
}

/** Clamp any incoming number to the 0..5 range (0 = not started). */
export function clampInductionStep(raw: unknown): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) return 0;
  if (raw < 0) return 0;
  if (raw > INDUCTION_TOTAL_STEPS) return INDUCTION_TOTAL_STEPS;
  return Math.trunc(raw);
}
