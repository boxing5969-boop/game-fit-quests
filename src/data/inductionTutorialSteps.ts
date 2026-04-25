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
 */

export type InductionStepId =
  | "profile"        // 1. 내 캐릭터 확인
  | "ranking"        // 2. 내 리그/레벨 확인
  | "quest"          // 3. 오늘의 퀘스트 확인
  | "rewards"        // 4. 젬/보상/이펙트 확인
  | "first_action";  // 5. 첫 체크인 또는 첫 퀘스트 수락

export interface InductionStep {
  /** 1..5 — server-side `tutorial_step` value after this step finishes. */
  order: 1 | 2 | 3 | 4 | 5;
  id: InductionStepId;
  title: string;
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
    title: "성장의 출발점",
    description: "내 복서 카드를 확인합니다. 이름·현재 상태가 모든 기록의 기준이 됩니다.",
    navTarget: "/mypage",
    rewardGems: 100,
  },
  {
    order: 2,
    id: "ranking",
    title: "지금 서 있는 자리",
    description: "백 → 청 → 적 → 흑 단계적 성장 구조. 현재 리그·레벨이 다음 승급 목표가 됩니다.",
    navTarget: "/halloffame",
    rewardGems: 100,
  },
  {
    order: 3,
    id: "quest",
    title: "오늘의 훈련",
    description: "복싱·자세·습관 — 오늘 해야 할 훈련이 준비돼 있습니다. 매일의 한 줄이 다음 단증의 근거가 됩니다.",
    navTarget: "/missions",
    rewardGems: 200,
  },
  {
    order: 4,
    id: "rewards",
    title: "파이트 머니 · 성취 보상",
    description: "훈련 완수 시 파이트 머니가 지급됩니다. 복서 카드 장식·단증 혜택 등 실제 가치로 연결됩니다.",
    navTarget: "/rewards",
    rewardGems: 200,
  },
  {
    order: 5,
    id: "first_action",
    title: "첫 훈련 기록",
    description: "오늘의 훈련 중 하나를 골라 시작합니다. 첫 기록부터 당신의 성장이 측정되기 시작합니다.",
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
