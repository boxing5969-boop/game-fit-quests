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
  /** Master track opt-in flag (migration 20260420160000). */
  master_track_unlocked?: boolean;
  /** 1..59 when master track is unlocked. */
  master_level?: number;
}

/**
 * Normalize all progression inputs into a single integer level (1..99)
 * used across the unlock system. Safe for unknown/null inputs → returns 1.
 *
 * Precedence:
 *   1. master_track_unlocked → 40 + master_level (41..99)
 *   2. is_in_hall_of_fame    → 99 (pre-master-track legacy signal)
 *   3. black Lv10 + bosses≥4 → 50 (pre-master-track master tier)
 *   4. rankIdx*10 + level    → 1..40 (default)
 */
export function computeUserLevel({
  current_rank,
  current_level,
  bosses_cleared = 0,
  is_in_hall_of_fame = false,
  master_track_unlocked = false,
  master_level = 0,
}: UserLevelInput): number {
  if (master_track_unlocked && master_level >= 1) {
    return 40 + Math.min(master_level, 59);
  }
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

// ══ Effect unlock rules (36 — full coverage) ═══════════════
// All 36 EFFECT_OPTIONS in characterCustomizationData.ts now have a
// level gate. Tier mapping mirrors the league field on each option:
//   white  → Lv 1, 5
//   blue   → Lv 10, 15
//   red    → Lv 20, 25
//   black  → Lv 30, 35, 40, 50

export const EFFECT_UNLOCK_RULES: UnlockRule[] = [
  // ── Lv1 (white starters, free) ─────────────────────────────
  { itemKey: "sparkle",      category: "effect", requiredLevel: 1 },
  { itemKey: "stars",        category: "effect", requiredLevel: 1 },
  { itemKey: "wind",         category: "effect", requiredLevel: 1 },
  { itemKey: "daisy",        category: "effect", requiredLevel: 1 },
  // ── Lv5 (white) ────────────────────────────────────────────
  { itemKey: "flame",        category: "effect", requiredLevel: 5 },
  { itemKey: "hearts",       category: "effect", requiredLevel: 5 },
  { itemKey: "sunflower",    category: "effect", requiredLevel: 5 },
  { itemKey: "clover",       category: "effect", requiredLevel: 5 },
  // ── Lv10 (blue) ────────────────────────────────────────────
  { itemKey: "lightning",    category: "effect", requiredLevel: 10 },
  { itemKey: "snow",         category: "effect", requiredLevel: 10 },
  { itemKey: "music",        category: "effect", requiredLevel: 10 },
  // ── Lv15 (blue, floral/festive) ────────────────────────────
  { itemKey: "cherry",       category: "effect", requiredLevel: 15 },
  { itemKey: "tulip",        category: "effect", requiredLevel: 15 },
  { itemKey: "firework",     category: "effect", requiredLevel: 15 },
  { itemKey: "hibiscus",     category: "effect", requiredLevel: 15 },
  // ── Lv20 (red, dynamic) ────────────────────────────────────
  { itemKey: "tornado",      category: "effect", requiredLevel: 20 },
  { itemKey: "comet",        category: "effect", requiredLevel: 20 },
  { itemKey: "rainbow",      category: "effect", requiredLevel: 20 },
  // ── Lv25 (red+) ────────────────────────────────────────────
  { itemKey: "bouquet",      category: "effect", requiredLevel: 25 },
  { itemKey: "ghost",        category: "effect", requiredLevel: 25 },
  { itemKey: "star_shoot",   category: "effect", requiredLevel: 25 },
  // ── Lv30 (black entry, epic) ───────────────────────────────
  { itemKey: "rose",         category: "effect", requiredLevel: 30 },
  { itemKey: "explosion",    category: "effect", requiredLevel: 30 },
  { itemKey: "phoenix",      category: "effect", requiredLevel: 30 },
  { itemKey: "dragon",       category: "effect", requiredLevel: 30 },
  { itemKey: "crown_effect", category: "effect", requiredLevel: 30 },
  { itemKey: "lotus",        category: "effect", requiredLevel: 30 },
  // ── Lv35 (black mid) ───────────────────────────────────────
  { itemKey: "skull",        category: "effect", requiredLevel: 35 },
  { itemKey: "diamond_rain", category: "effect", requiredLevel: 35 },
  { itemKey: "sakura_storm", category: "effect", requiredLevel: 35 },
  // ── Lv40 (black late) ──────────────────────────────────────
  { itemKey: "inferno_dual", category: "effect", requiredLevel: 40 },
  { itemKey: "thunder_god",  category: "effect", requiredLevel: 40 },
  // ── Lv50 (black master, legendary visuals) ─────────────────
  { itemKey: "cosmic_dust",  category: "effect", requiredLevel: 50 },
  { itemKey: "sword_aura",   category: "effect", requiredLevel: 50 },
  { itemKey: "dark_flame",   category: "effect", requiredLevel: 50 },
  { itemKey: "rose_gold",    category: "effect", requiredLevel: 50 },
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
  { itemKey: "rookie_challenger", category: "title", requiredLevel: 1, displayNameOverride: "신입 챌린저" },
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
// 5-step 행동 기반 튜토리얼 플로우 (오삼 마스코트 가이드).
// 사용자가 실제로 페이지에 가서 행동을 해야 advance.
// 각 단계 자동완료감지(detector) + 백업 수동 완료 버튼 동시 지원.
//   1) 프로필 사진 설정    — profile.avatar_url 변경 감지
//   2) 마이복서153 알아보기 — /guide 진입 + 일정시간 체류 OR 수동
//   3) 오늘의 미션 완료    — daily_quest_completions row 생성
//   4) 첫 출석 체크인      — attendance_logs row 생성
//   5) 첫 챌린지 참여      — challenge_participants row 생성

export type TutorialStepKey =
  | "profile_photo"
  | "discover_app"
  | "first_mission"
  | "first_checkin"
  | "first_challenge";

/**
 * 자동완료 감지 키 — TutorialActionDetector 훅에서 사용.
 *   · "avatar_set"     — profile.avatar_url 이 set 됨 (null → string)
 *   · "viewed_guide"   — /guide 또는 /about 페이지에 5초 이상 체류
 *   · "viewed_missions" — /missions 페이지에 5초 이상 체류 (탭 둘러보기 충분)
 *   · "mission_done"   — 오늘 첫 mission completion row 생성 (legacy)
 *   · "first_attendance" — attendance_logs 첫 row
 *   · "first_challenge"  — challenge_participants 첫 row
 */
export type TutorialDetectorKey =
  | "avatar_set"
  | "viewed_guide"
  | "viewed_missions"
  | "mission_done"
  | "first_attendance"
  | "first_challenge";

export interface TutorialStep {
  key: TutorialStepKey;
  order: number;
  /** 짧은 미션 라벨 (mascot 말풍선용) */
  label: string;
  /** 한 줄 설명 (미션 카드 본문) */
  description: string;
  /** 마스코트 안내 멘트 (해당 페이지 진입 시 표시) */
  hint: string;
  /** Primary CTA label on the tutorial modal. */
  ctaLabel: string;
  /** Route to navigate to when the user taps the CTA. */
  navTarget?: string;
  /** 자동 완료 감지 키 — undefined 면 수동 완료만 가능 */
  detector?: TutorialDetectorKey;
  /** 미션 아이콘 (이모지) */
  icon: string;
  /**
   * navTarget 페이지에서 강조할 element 의 CSS 셀렉터.
   * 매칭되면 무지개 그라데이션 spotlight overlay 가 떠서 회원에게
   * "여기를 누르세요" 안내. 미매칭 시 기본 floating 안내만 표시.
   */
  spotlightSelector?: string;
  /** spotlight 위 말풍선 한 줄 안내. 미정의 시 hint 사용. */
  spotlightHint?: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    key: "profile_photo",
    order: 1,
    label: "프로필 사진 설정",
    description: "내 얼굴이 보여야 라이브보드에서 더 멋있게 등장해요.",
    hint: "마이페이지에서 프로필 사진을 업로드해보세요. 카메라 아이콘을 누르면 됩니다.",
    ctaLabel: "내 프로필 가기",
    navTarget: "/mypage",
    detector: "avatar_set",
    icon: "🥊",
    spotlightSelector: '[data-tutorial-target="profile-photo-button"]',
    spotlightHint: "여기 카메라 아이콘을 눌러 프로필 사진을 올려주세요.",
  },
  {
    key: "discover_app",
    order: 2,
    label: "마이복서153 알아보기",
    description: "이 앱이 어떤 가치를 만들고, 무엇을 향해 가는지 한 번 읽어보세요.",
    hint: "프로그램 소개 / 가치맵 / 과학적 설계 — 핵심 페이지 한 곳만 봐도 충분합니다.",
    ctaLabel: "가이드 열기",
    navTarget: "/guide",
    detector: "viewed_guide",
    icon: "📖",
    spotlightSelector: '[data-tutorial-target="guide-first-card"]',
    spotlightHint: "여기 카드 한 장만 들어가서 잠시 읽어보면 자동으로 완료돼요.",
  },
  {
    key: "first_mission",
    order: 3,
    label: "훈련 미션 둘러보기",
    description: "훈련 화면을 한 번 둘러보세요. 화이트 리그와 전체 미션 탭이 보여요.",
    hint: "훈련 페이지에 들어가 화이트 리그 / 전체 미션 두 탭을 한 번씩 살펴보세요. 잠깐 머무는 것만으로 자동 완료돼요.",
    ctaLabel: "훈련 화면 보기",
    navTarget: "/missions",
    detector: "viewed_missions",
    icon: "⚡",
    spotlightSelector: '[data-tour="missions-tab-control"]',
    spotlightHint: "두 탭을 잠깐 둘러보면 자동으로 완료돼요.",
  },
  {
    key: "first_checkin",
    order: 4,
    label: "첫 출석 체크인",
    description: "QR 을 스캔하면 출석이 기록되고 라이브보드에 등장합니다.",
    hint: "홈 화면 상단의 'QR 체크인 하기' 버튼을 눌러 코치님의 QR을 스캔하세요.",
    ctaLabel: "QR 체크인 가기",
    navTarget: "/home",
    detector: "first_attendance",
    icon: "📍",
    spotlightSelector: '[data-tutorial-target="qr-checkin-button"]',
    spotlightHint: "여기를 눌러 코치님의 QR을 스캔해주세요.",
  },
  {
    key: "first_challenge",
    order: 5,
    label: "첫 챌린지 참여",
    description: "혼자가 아니라 함께. 더 파이터 시즌 챌린지에 참여해보세요.",
    hint: "챌린지 페이지에서 진행 중인 챌린지를 골라 참여하기 버튼을 누르세요.",
    ctaLabel: "챌린지 가기",
    navTarget: "/challenges",
    detector: "first_challenge",
    icon: "🏆",
    spotlightSelector: '[data-tutorial-target="first-challenge-card"]',
    spotlightHint: "이 챌린지 카드를 누르고 참여하기를 눌러보세요.",
  },
];

/** 단계별 즉시 지급 보상 (서버 tutorial_step_reward_amount 와 동일). */
export const TUTORIAL_STEP_REWARDS: Record<number, number> = {
  1: 200,
  2: 200,
  3: 200,
  4: 200,
  5: 200,
};

/** 합산 = 1000. 표시용 단일 상수. */
export const TUTORIAL_REWARD_GEMS = Object.values(TUTORIAL_STEP_REWARDS).reduce(
  (a, b) => a + b,
  0,
);

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
