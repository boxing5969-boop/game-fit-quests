/**
 * 153 스토리 RPG — 적 SVG variant 매핑 (Stage 47B).
 *
 * 11 적 unique SVG. 보편적 도상 (슬라임/늑대/로봇/그림자) — 외부 IP 0.
 */

export type EnemyVariant =
  | "lazy_slime"
  | "guard_breaker"
  | "tension_wolf"
  | "overtraining_golem"
  | "master_door"
  | "routine_breaker"
  | "compare_monster"
  | "shadow_rival"
  | "camp_guard"
  | "crowd_illusion"
  | "self_doubt";

// 마이그레이션 seed 의 enemy.code → variant.
// (seed 는 tense_wolf / overtrain_golem / self_compare_evolved 등 실제 키 사용)
export const ENEMY_CODE_TO_VARIANT: Record<string, EnemyVariant> = {
  // 직접 매칭
  lazy_slime: "lazy_slime",
  guard_breaker: "guard_breaker",
  master_door: "master_door",
  routine_breaker: "routine_breaker",
  compare_monster: "compare_monster",
  shadow_rival: "shadow_rival",
  camp_guard: "camp_guard",
  crowd_illusion: "crowd_illusion",
  self_doubt: "self_doubt",

  // seed 키 → variant 별칭
  tense_wolf: "tension_wolf",
  tension_wolf: "tension_wolf",
  overtrain_golem: "overtraining_golem",
  overtraining_golem: "overtraining_golem",
  self_compare_evolved: "compare_monster",
  excuse_goblin: "shadow_rival",
  quit_demon: "shadow_rival",
  breath_holder: "self_doubt",
};

export function resolveEnemyVariant(code: string): EnemyVariant {
  return ENEMY_CODE_TO_VARIANT[code] ?? "shadow_rival";
}
