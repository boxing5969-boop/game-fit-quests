/**
 * 153 스토리 RPG — 챕터 노드 좌표 + 아이콘 변형 매핑 (Stage 47A).
 *
 * Stage 44 시나리오 chapter.code → 월드맵 좌표 (% 단위) + 아이콘 종류.
 * Stage 45 DB 의 18챕터 모두 커버.
 */

export type ChapterIconVariant =
  | "door_open"
  | "two_gloves"
  | "mirror"
  | "rope_sun"
  | "broken_glove"
  | "master_door"
  | "metronome"
  | "shadow_pair"
  | "helping_hand"
  | "broken_clock"
  | "inner_ring"
  | "infinite_mirror"
  | "ring_corner"
  | "sandbag"
  | "champion_belt"
  | "rival_arena"
  | "fight_camp"
  | "boxing_hall";

export interface ChapterCoord {
  x: string; // CSS percentage
  y: string;
  icon: ChapterIconVariant;
}

export const CHAPTER_LAYOUT: Record<string, ChapterCoord> = {
  // ── 마스터의 길 (지그재그 우상향) ─────────────────────
  master_01_first_glove: { x: "16%", y: "82%", icon: "door_open" },
  master_02_basic_wall: { x: "30%", y: "68%", icon: "mirror" },
  master_03_repeat_room: { x: "46%", y: "78%", icon: "sandbag" },
  master_04_new_member: { x: "60%", y: "62%", icon: "two_gloves" },
  master_05_trainer_eye: { x: "74%", y: "52%", icon: "helping_hand" },
  master_06_master_test: { x: "88%", y: "30%", icon: "master_door" },

  // ── 프로의 길 ─────────────────────────────────────────
  pro_01_hobby_start: { x: "14%", y: "78%", icon: "door_open" },
  pro_02_routine_birth: { x: "30%", y: "70%", icon: "rope_sun" },
  pro_03_first_spar_tension: { x: "48%", y: "60%", icon: "ring_corner" },
  pro_04_stamina_wall: { x: "60%", y: "72%", icon: "sandbag" },
  pro_05_my_style: { x: "74%", y: "50%", icon: "metronome" },
  pro_06_pro_routine_test: { x: "88%", y: "32%", icon: "broken_clock" },

  // ── 챔피언 로드 ───────────────────────────────────────
  champ_01_contender_gate: { x: "16%", y: "80%", icon: "door_open" },
  champ_02_shadow_boxer: { x: "32%", y: "66%", icon: "infinite_mirror" },
  champ_03_rival_match: { x: "50%", y: "76%", icon: "rival_arena" },
  champ_04_fight_camp: { x: "64%", y: "58%", icon: "fight_camp" },
  champ_05_last_round: { x: "76%", y: "44%", icon: "ring_corner" },
  champ_06_champion_night: { x: "88%", y: "26%", icon: "boxing_hall" },
};
