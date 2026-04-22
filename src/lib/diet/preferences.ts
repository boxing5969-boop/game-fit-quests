/**
 * 153 다이어트 — 사용자 환경설정 타입 + 기본값 + 머지 헬퍼.
 *
 * DB 저장은 jsonb (public.diet_preferences.settings) 한 개이며, 미래
 * 확장 시 컬럼 추가 없이 키만 늘어나면 된다.
 */

import type { DietMaintenanceVariantId } from "@/data/diet/maintenanceVariants";

export interface DietPreferences {
  reminders: {
    /** 아침 오늘의 미션 안내 배너 */
    morning: boolean;
    /** 점심 전후 식단/단백질/물 체크 유도 */
    midday: boolean;
    /** 저녁 야식 방지 + 체크인 리마인드 */
    evening: boolean;
  };
  notifications: {
    /** 코치 피드백 도착 시 in-app 알림 표시 */
    coach_feedback: boolean;
    /** 배지·보상 알림 노출 */
    badge_reward: boolean;
  };
  privacy: {
    /** 지점 랭킹에 본인 노출 여부. false 면 get_diet_ranking 에서 제외됨. */
    ranking_visible: boolean;
  };
  /** 21일 완주 후 선택한 유지 플랜 id (미선택 시 null). */
  maintenance_variant: DietMaintenanceVariantId | null;
  /**
   * DIY 식단 구성 — 각 끼니 슬롯별 선택한 음식 이름 배열.
   * 사용자가 MealPlan 페이지의 구성 빌더로 저장. 비어있으면 아직 미설정.
   */
  custom_meal_plan: {
    breakfast: string[];
    lunch: string[];
    dinner: string[];
    snack: string[];
  };
}

export const DEFAULT_DIET_PREFERENCES: DietPreferences = Object.freeze({
  reminders: { morning: true, midday: true, evening: true },
  notifications: { coach_feedback: true, badge_reward: true },
  privacy: { ranking_visible: true },
  maintenance_variant: null,
  custom_meal_plan: {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: [],
  },
}) as DietPreferences;

/**
 * DB/외부 입력 jsonb 를 안전하게 DietPreferences 로 머지.
 * 누락 키는 기본값으로 채우며, 알 수 없는 키는 무시.
 */
export function mergeDietPreferences(raw: unknown): DietPreferences {
  const base: DietPreferences = {
    reminders: { ...DEFAULT_DIET_PREFERENCES.reminders },
    notifications: { ...DEFAULT_DIET_PREFERENCES.notifications },
    privacy: { ...DEFAULT_DIET_PREFERENCES.privacy },
    maintenance_variant: DEFAULT_DIET_PREFERENCES.maintenance_variant,
    custom_meal_plan: {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    },
  };
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const rem = (r.reminders ?? {}) as Record<string, unknown>;
  const not = (r.notifications ?? {}) as Record<string, unknown>;
  const prv = (r.privacy ?? {}) as Record<string, unknown>;
  const bool = (v: unknown, fallback: boolean): boolean =>
    typeof v === "boolean" ? v : fallback;
  base.reminders.morning = bool(rem.morning, base.reminders.morning);
  base.reminders.midday = bool(rem.midday, base.reminders.midday);
  base.reminders.evening = bool(rem.evening, base.reminders.evening);
  base.notifications.coach_feedback = bool(
    not.coach_feedback,
    base.notifications.coach_feedback,
  );
  base.notifications.badge_reward = bool(
    not.badge_reward,
    base.notifications.badge_reward,
  );
  base.privacy.ranking_visible = bool(
    prv.ranking_visible,
    base.privacy.ranking_visible,
  );
  const mv = r.maintenance_variant;
  const allowed: DietMaintenanceVariantId[] = [
    "early_bird",
    "night_owl",
    "social_eater",
    "weekend_relapse",
  ];
  base.maintenance_variant =
    typeof mv === "string" && (allowed as string[]).includes(mv)
      ? (mv as DietMaintenanceVariantId)
      : null;

  // custom_meal_plan — 슬롯별 string[] 만 허용
  const cmp = (r.custom_meal_plan ?? {}) as Record<string, unknown>;
  const toStrArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((i) => typeof i === "string") : [];
  base.custom_meal_plan = {
    breakfast: toStrArr(cmp.breakfast),
    lunch: toStrArr(cmp.lunch),
    dinner: toStrArr(cmp.dinner),
    snack: toStrArr(cmp.snack),
  };

  return base;
}

// ──────────────────────────────────────────────────────────────────
// 시간대 판정 — 배너 톤 전환용
// ──────────────────────────────────────────────────────────────────
export type DietReminderSlot = "morning" | "midday" | "evening" | null;

/**
 * 현재 시각(기본: 로컬) 을 3구간 중 하나로 매핑.
 *   07:00~10:59 → morning
 *   11:00~14:59 → midday
 *   17:00~21:59 → evening
 *   이외 → null
 */
export function resolveReminderSlot(now: Date = new Date()): DietReminderSlot {
  const h = now.getHours();
  if (h >= 7 && h <= 10) return "morning";
  if (h >= 11 && h <= 14) return "midday";
  if (h >= 17 && h <= 21) return "evening";
  return null;
}

export function isReminderEnabled(
  prefs: DietPreferences,
  slot: DietReminderSlot,
): boolean {
  if (!slot) return false;
  return prefs.reminders[slot];
}
