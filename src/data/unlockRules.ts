/**
 * unlockRules.ts — 랭킹업 해금/튜토리얼 단일 설정 파일
 *
 * 이 파일은 "누가 언제 무엇을 해금할 수 있나"의 단일 소스입니다.
 * UI(해금 표시), 서버 검증(RPC), 레벨업 알림 모두 이 파일을 참조합니다.
 *
 * ──────────────────────────────────────────────────────────────
 *  설계 결정 (사용자 승인 반영)
 *
 *  D1: 기존 CustomizationOption.key 는 유지하고 UI 라벨만 요구
 *      문구로 덮어쓰는 방식. `displayNameOverride` 가 있으면 UI 에서
 *      우선 사용, 없으면 원본 label 사용.
 *
 *  D2: user_level 정의
 *    1..40 = RANK_ORDER.indexOf(rank) * 10 + current_level
 *    50    = 마스터  (black Lv10 + bosses_cleared >= 4)
 *    99    = 명예의 전당 입성
 *
 *  항목 초과분(기존 자산 > 요구 수) 은 이 파일에 등록하지 않고
 *  기존 price 기반 상점에서 그대로 구매 가능합니다. 즉 이 파일은
 *  "레벨 해금 대상인 부분집합" 만 관리하며, 나머지는 손대지 않습니다.
 * ──────────────────────────────────────────────────────────────
 */

import { RANK_ORDER } from "./sharedConstants";
import type { Enums } from "@/integrations/supabase/types";

// ══ Types ══════════════════════════════════════════════════

export type UnlockCategory = "effect" | "frame" | "title" | "aura";

export interface UnlockRule {
  /** Matches CustomizationOption.key in characterCustomizationData.ts */
  itemKey: string;
  category: UnlockCategory;
  /** 1, 5, 10, 15, 20, 30, 50, 99 … */
  requiredLevel: number;
  /** Optional UI label override (D1). Falls back to original label. */
  displayNameOverride?: string;
}

// ══ User-level computation ═════════════════════════════════

export interface UserLevelInput {
  current_rank: string;
  current_level: number;
  bosses_cleared?: number;
  is_in_hall_of_fame?: boolean;
}

/**
 * Normalize (rank, level, bosses, HoF) into a single integer level used
 * across the unlock system. Safe for unknown/null inputs → returns 1.
 */
export function computeUserLevel({
  current_rank,
  current_level,
  bosses_cleared = 0,
  is_in_hall_of_fame = false,
}: UserLevelInput): number {
  if (is_in_hall_of_fame) return 99;
  if (
    current_rank === "black" &&
    current_level === 10 &&
    bosses_cleared >= 4
  ) {
    return 50;
  }
  const rankIdx = RANK_ORDER.indexOf(current_rank as Enums<"rank_name">);
  if (rankIdx < 0) return 1;
  return rankIdx * 10 + (current_level || 1);
}

// ══ Effect unlock rules (20) ═══════════════════════════════
// Picks from EFFECT_OPTIONS in characterCustomizationData.ts.
// Selection heuristic: lowest-price basics at Lv1, progressively
// richer visuals as league tier rises. Purely additive — the other
// 16 effect options stay price-only purchasable on existing shop.

export const EFFECT_UNLOCK_RULES: UnlockRule[] = [
  // Lv1 × 4 (white, free starters)
  { itemKey: "sparkle",  category: "effect", requiredLevel: 1 },
  { itemKey: "stars",    category: "effect", requiredLevel: 1 },
  { itemKey: "wind",     category: "effect", requiredLevel: 1 },
  { itemKey: "daisy",    category: "effect", requiredLevel: 1 },
  // Lv5 × 3 (white, low-price warm-up)
  { itemKey: "flame",    category: "effect", requiredLevel: 5 },
  { itemKey: "hearts",   category: "effect", requiredLevel: 5 },
  { itemKey: "sunflower", category: "effect", requiredLevel: 5 },
  // Lv10 × 3 (blue, mid-tier motion)
  { itemKey: "lightning", category: "effect", requiredLevel: 10 },
  { itemKey: "snow",     category: "effect", requiredLevel: 10 },
  { itemKey: "music",    category: "effect", requiredLevel: 10 },
  // Lv15 × 3 (blue-red bridge, floral/festive)
  { itemKey: "cherry",   category: "effect", requiredLevel: 15 },
  { itemKey: "tulip",    category: "effect", requiredLevel: 15 },
  { itemKey: "firework", category: "effect", requiredLevel: 15 },
  // Lv20 × 3 (red, dynamic)
  { itemKey: "tornado",  category: "effect", requiredLevel: 20 },
  { itemKey: "comet",    category: "effect", requiredLevel: 20 },
  { itemKey: "rainbow",  category: "effect", requiredLevel: 20 },
  // Lv30 × 4 (red-black epic)
  { itemKey: "rose",     category: "effect", requiredLevel: 30 },
  { itemKey: "explosion", category: "effect", requiredLevel: 30 },
  { itemKey: "phoenix",  category: "effect", requiredLevel: 30 },
  { itemKey: "dragon",   category: "effect", requiredLevel: 30 },
];

// ══ Frame unlock rules (10) ════════════════════════════════

export const FRAME_UNLOCK_RULES: UnlockRule[] = [
  // Lv1 × 2
  { itemKey: "basic_white", category: "frame", requiredLevel: 1 },
  { itemKey: "fire",        category: "frame", requiredLevel: 1 },
  // Lv5 × 1
  { itemKey: "ice",         category: "frame", requiredLevel: 5 },
  // Lv10 × 2
  { itemKey: "ocean",       category: "frame", requiredLevel: 10 },
  { itemKey: "emerald",     category: "frame", requiredLevel: 10 },
  // Lv20 × 2
  { itemKey: "gold",        category: "frame", requiredLevel: 20 },
  { itemKey: "rainbow",     category: "frame", requiredLevel: 20 },
  // Lv30 × 2
  { itemKey: "galaxy",      category: "frame", requiredLevel: 30 },
  { itemKey: "holy",        category: "frame", requiredLevel: 30 },
  // Lv50 × 1 (legend, 마스터 달성 시)
  { itemKey: "eternal",     category: "frame", requiredLevel: 50 },
];

// ══ Title unlock rules (8) ═════════════════════════════════
// D1: key 유지 + UI 오버라이드 라벨 함께 저장.

export const TITLE_UNLOCK_RULES: UnlockRule[] = [
  { itemKey: "beginner",     category: "title", requiredLevel: 1,  displayNameOverride: "입문자" },
  { itemKey: "trainee",      category: "title", requiredLevel: 5,  displayNameOverride: "복서 지망생" },
  { itemKey: "fighter",      category: "title", requiredLevel: 10, displayNameOverride: "아마추어 복서" },
  { itemKey: "warrior",      category: "title", requiredLevel: 15, displayNameOverride: "링의 도전자" },
  { itemKey: "iron_fist",    category: "title", requiredLevel: 20, displayNameOverride: "프로 복서" },
  { itemKey: "thunder_king", category: "title", requiredLevel: 30, displayNameOverride: "챔피언 후보" },
  { itemKey: "champion",     category: "title", requiredLevel: 50 }, // 원본 label = "챔피언" 일치
  { itemKey: "legend",       category: "title", requiredLevel: 99 }, // 원본 label = "레전드" 일치
];

// ══ Aura unlock rules (6) ══════════════════════════════════

export const AURA_UNLOCK_RULES: UnlockRule[] = [
  { itemKey: "aura_ocean",      category: "aura", requiredLevel: 1,  displayNameOverride: "블루 오라" },
  { itemKey: "aura_emerald",    category: "aura", requiredLevel: 5,  displayNameOverride: "그린 오라" },
  { itemKey: "aura_phantom",    category: "aura", requiredLevel: 10, displayNameOverride: "퍼플 오라" },
  { itemKey: "aura_fire",       category: "aura", requiredLevel: 20, displayNameOverride: "레드 오라" },
  { itemKey: "halo_black_gold", category: "aura", requiredLevel: 30, displayNameOverride: "골드 오라" },
  { itemKey: "aura_rainbow",    category: "aura", requiredLevel: 50, displayNameOverride: "레인보우 오라" },
];

// ══ Unified lookup index ═══════════════════════════════════

export const ALL_UNLOCK_RULES: UnlockRule[] = [
  ...EFFECT_UNLOCK_RULES,
  ...FRAME_UNLOCK_RULES,
  ...TITLE_UNLOCK_RULES,
  ...AURA_UNLOCK_RULES,
];

const UNLOCK_INDEX: Record<UnlockCategory, Map<string, UnlockRule>> = {
  effect: new Map(EFFECT_UNLOCK_RULES.map((r) => [r.itemKey, r])),
  frame: new Map(FRAME_UNLOCK_RULES.map((r) => [r.itemKey, r])),
  title: new Map(TITLE_UNLOCK_RULES.map((r) => [r.itemKey, r])),
  aura: new Map(AURA_UNLOCK_RULES.map((r) => [r.itemKey, r])),
};

/**
 * O(1) lookup. Returns undefined if the item is NOT under level-based
 * control (i.e. price-only purchasable from the existing shop).
 */
export function getUnlockRule(
  category: UnlockCategory,
  itemKey: string,
): UnlockRule | undefined {
  return UNLOCK_INDEX[category].get(itemKey);
}

/**
 * True when the item has either no level rule (price-only) or the
 * user's level meets the required threshold. Server-side logic MUST
 * mirror this.
 */
export function isItemUnlocked(
  category: UnlockCategory,
  itemKey: string,
  userLevel: number,
): boolean {
  const rule = UNLOCK_INDEX[category].get(itemKey);
  if (!rule) return true; // not under level control
  return userLevel >= rule.requiredLevel;
}

/**
 * Lock hint for UI. Returns "Lv.N 해금" copy when the item is
 * level-locked; empty string when it's already unlocked or not a
 * level-controlled item.
 */
export function getLockMessage(
  category: UnlockCategory,
  itemKey: string,
  userLevel: number,
): string {
  const rule = UNLOCK_INDEX[category].get(itemKey);
  if (!rule) return "";
  if (userLevel >= rule.requiredLevel) return "";
  return `Lv.${rule.requiredLevel} 해금`;
}

/**
 * For "새 아이템 해금!" notification — returns every rule whose
 * requiredLevel was crossed by the level bump.
 */
export function getNewlyUnlockedBetween(
  previousLevel: number,
  newLevel: number,
): UnlockRule[] {
  if (newLevel <= previousLevel) return [];
  return ALL_UNLOCK_RULES.filter(
    (r) => r.requiredLevel > previousLevel && r.requiredLevel <= newLevel,
  );
}

/**
 * Display label for the title/aura UI, honoring the D1 override rule.
 * Falls back to `fallbackLabel` (typically the original label from
 * characterCustomizationData.ts).
 */
export function resolveDisplayName(
  category: UnlockCategory,
  itemKey: string,
  fallbackLabel: string,
): string {
  const rule = UNLOCK_INDEX[category].get(itemKey);
  return rule?.displayNameOverride ?? fallbackLabel;
}

// ══ Tutorial ═══════════════════════════════════════════════
// 5-step flow: profile → ranking → effect shop → mini game → done.
// Each step is marked complete via useTutorialState (Step 3). Final
// completion triggers the server-side grant_tutorial_reward RPC
// (Step 2) which credits 1000 gems exactly once per profile.

export type TutorialStepKey =
  | "profile"
  | "ranking"
  | "effect_shop"
  | "mini_game"
  | "complete";

export interface TutorialStep {
  key: TutorialStepKey;
  order: number;
  label: string;
  description: string;
  /** Primary CTA label on the tutorial modal. */
  ctaLabel: string;
  /** Route to navigate to when the user taps the CTA. */
  navTarget?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    key: "profile",
    order: 1,
    label: "프로필 확인",
    description: "내 캐릭터와 리그 정보를 확인해보세요.",
    ctaLabel: "내 프로필 보기",
    navTarget: "/mypage",
  },
  {
    key: "ranking",
    order: 2,
    label: "랭킹 확인",
    description: "우리 지점 회원들의 랭킹을 살펴보세요.",
    ctaLabel: "랭킹 보기",
    navTarget: "/halloffame",
  },
  {
    key: "effect_shop",
    order: 3,
    label: "효과 상점",
    description: "캐릭터를 꾸밀 수 있는 효과를 둘러보세요.",
    ctaLabel: "효과 둘러보기",
    navTarget: "/character-studio",
  },
  {
    key: "mini_game",
    order: 4,
    label: "첫 도전",
    description: "5초짜리 첫 도전 인트로로 앱 사용을 시작합니다.",
    ctaLabel: "시작하기",
    navTarget: "/home",
  },
  {
    key: "complete",
    order: 5,
    label: "튜토리얼 완료",
    description: "1000 젬을 받고 정식 훈련을 시작합니다.",
    ctaLabel: "보상 받기",
  },
];

export const TUTORIAL_REWARD_GEMS = 1000;

/** Step count excluding the terminal "complete" stage. */
export const TUTORIAL_TOTAL_STEPS = TUTORIAL_STEPS.length - 1;

// ══ Public utility API (Step 3) ════════════════════════════
// Thin, pure helpers so every consumer goes through one surface
// instead of duplicating inline checks. All inputs are plain values
// so the functions are trivially testable and SSR-safe.

/** Identifier pair used by every status/unlocked/locked helper. */
export interface UnlockItemRef {
  category: UnlockCategory;
  itemKey: string;
}

/** Result of getUnlockStatus — covers both level-gated and price-only items. */
export interface UnlockStatus {
  /** null when item is not under level control (price-only). */
  requiredLevel: number | null;
  locked: boolean;
  /** Korean hint for UI; empty when unlocked or not level-controlled. */
  message: string;
}

/** Minimal row shape for isTutorialCompleted — accepts any profile-like. */
export interface TutorialUserLike {
  tutorial_completed?: boolean | null;
}

/** Returns the 5-step tutorial definition (frozen order). */
export function getTutorialSteps(): TutorialStep[] {
  return TUTORIAL_STEPS;
}

/** True when the given profile row has the server flag set. */
export function isTutorialCompleted(
  user: TutorialUserLike | null | undefined,
): boolean {
  return !!user?.tutorial_completed;
}

/** Combined lock state for a single item — level + message in one call. */
export function getUnlockStatus(
  userLevel: number,
  item: UnlockItemRef,
): UnlockStatus {
  const rule = UNLOCK_INDEX[item.category].get(item.itemKey);
  if (!rule) {
    return { requiredLevel: null, locked: false, message: "" };
  }
  const locked = userLevel < rule.requiredLevel;
  return {
    requiredLevel: rule.requiredLevel,
    locked,
    message: locked ? `Lv.${rule.requiredLevel} 해금` : "",
  };
}

/** Rules in `category` whose requiredLevel is satisfied by `userLevel`. */
export function getUnlockedItems(
  category: UnlockCategory,
  userLevel: number,
): UnlockRule[] {
  return Array.from(UNLOCK_INDEX[category].values()).filter(
    (r) => userLevel >= r.requiredLevel,
  );
}

/** Rules in `category` still beyond `userLevel`. */
export function getLockedItems(
  category: UnlockCategory,
  userLevel: number,
): UnlockRule[] {
  return Array.from(UNLOCK_INDEX[category].values()).filter(
    (r) => userLevel < r.requiredLevel,
  );
}

/**
 * Rules unlocked by a level bump (prev, current]. Alias for
 * getNewlyUnlockedBetween — the Step 3 spec asks for this name.
 */
export function getNewUnlocks(
  prevLevel: number,
  currentLevel: number,
): UnlockRule[] {
  return getNewlyUnlockedBetween(prevLevel, currentLevel);
}

/**
 * Gate used by server-mirroring purchase flows. Price-only items
 * (no level rule) return true regardless; the wallet balance check
 * happens downstream.
 */
export function canPurchaseItem(
  userLevel: number,
  item: UnlockItemRef,
): boolean {
  const rule = UNLOCK_INDEX[item.category].get(item.itemKey);
  if (!rule) return true;
  return userLevel >= rule.requiredLevel;
}
