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
    title: "내 캐릭터 확인",
    description: "첫 복서 카드를 확인해보자.",
    navTarget: "/mypage",
    rewardGems: 100,
  },
  {
    order: 2,
    id: "ranking",
    title: "내 리그 / 레벨 확인",
    description: "지금 어느 리그·레벨에 서 있는지 살펴보자.",
    navTarget: "/halloffame",
    rewardGems: 100,
  },
  {
    order: 3,
    id: "quest",
    title: "오늘의 퀘스트 확인",
    description: "오늘 진행할 퀘스트가 준비돼 있다.",
    navTarget: "/missions",
    rewardGems: 200,
  },
  {
    order: 4,
    id: "rewards",
    title: "젬 · 보상 · 이펙트 확인",
    description: "파이트 머니로 캐릭터를 꾸며볼 수 있다.",
    navTarget: "/rewards",
    rewardGems: 200,
  },
  {
    order: 5,
    id: "first_action",
    title: "첫 퀘스트 시작",
    description: "오늘의 퀘스트 목록에서 첫 퀘스트를 골라 시작해보자.",
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
