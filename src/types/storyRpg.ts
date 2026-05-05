/**
 * 153 스토리 RPG 타입 정의 (단계 35).
 *
 * Migration 20260705000000_boxing_story_rpg_foundation.sql 의 테이블/RPC 응답 형태.
 * types.ts(자동 생성) 가 아직 신규 테이블을 모르므로, service/hook 에서 cast 로 좁게 우회한다.
 */

export type StoryRouteType = "master" | "pro" | "champion";

export type StoryNodeType =
  | "gym"
  | "mirror"
  | "rope"
  | "sandbag"
  | "ring"
  | "corner"
  | "hall"
  | "master_room"
  | "camp"
  | "rival_arena";

export type StoryDialogueType =
  | "intro"
  | "progress"
  | "complete"
  | "locked"
  | "reward"
  | "boss";

export interface StoryRoute {
  id: string;
  code: string;
  title: string;
  subtitle: string | null;
  description: string;
  route_type: StoryRouteType;
  sort_order: number;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StoryNode {
  id: string;
  code: string;
  title: string;
  description: string;
  node_type: StoryNodeType;
  icon: string | null;
  sort_order: number;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface StoryChapter {
  id: string;
  route_id: string;
  code: string;
  chapter_number: number;
  title: string;
  subtitle: string | null;
  description: string;
  world_node_code: string;
  obstacle_code: string | null;
  unlock_condition: Record<string, unknown>;
  completion_condition: Record<string, unknown>;
  reward_quest_xp: number;
  reward_gems: number;
  reward_title: string | null;
  reward_card_code: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StoryDialogue {
  id: string;
  route_id: string | null;
  chapter_id: string | null;
  speaker: string;
  dialogue_type: StoryDialogueType;
  body: string;
  choices: StoryDialogueChoice[];
  sort_order: number;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface StoryDialogueChoice {
  label: string;
  action?: string;
  route?: string;
  metadata?: Record<string, unknown>;
}

export interface StoryProgress {
  id: string;
  user_id: string;
  route_id: string;
  current_chapter_id: string | null;
  current_chapter_number: number;
  completed_chapter_count: number;
  route_completed: boolean;
  selected_at: string;
  last_synced_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StoryRewardClaim {
  id: string;
  user_id: string;
  route_id: string;
  chapter_id: string;
  quest_xp_granted: number;
  gems_granted: number;
  reward_title: string | null;
  reward_card_code: string | null;
  claimed_at: string;
  metadata: Record<string, unknown>;
}

export interface StoryOfficialSummary {
  user_id: string;
  current_rank: string | null;
  current_level: number | null;
  total_xp: number | null;
  bosses_cleared: number | null;
  // member_progress 의 다른 컬럼은 read-only 로 그대로 통과
  [key: string]: unknown;
}

export interface StoryRpgState {
  active_route_id: string | null;
  routes: StoryRoute[];
  chapters: StoryChapter[];
  nodes: StoryNode[];
  dialogues: StoryDialogue[];
  progress: StoryProgress[];
  reward_claims: StoryRewardClaim[];
  official_summary: StoryOfficialSummary | null;
}

export interface StoryChapterProgressDetail {
  complete: boolean;
  locked_by_active_route: boolean;
  required_total?: number;
  have_total?: number;
  progress: Record<
    string,
    { have: number; need: number }
  >;
}

export interface StoryChapterSyncEntry {
  chapter_id: string;
  chapter_code: string;
  chapter_number: number;
  complete: boolean;
  detail: StoryChapterProgressDetail;
}

export interface StorySyncResult {
  success: boolean;
  route_code: string;
  completed_chapter_count: number;
  current_chapter_number: number;
  route_completed: boolean;
  chapters: StoryChapterSyncEntry[];
}

export interface StoryRewardResult {
  success: boolean;
  already_claimed?: boolean;
  reason?: string;
  quest_xp_granted: number;
  gems_granted: number;
  reward_title?: string | null;
  reward_card_code?: string | null;
  detail?: StoryChapterProgressDetail;
}

export interface StoryChooseRouteResult {
  success: boolean;
  route_id: string;
  route_code: string;
  first_chapter_id?: string;
}

export const EMPTY_STORY_RPG_STATE: StoryRpgState = {
  active_route_id: null,
  routes: [],
  chapters: [],
  nodes: [],
  dialogues: [],
  progress: [],
  reward_claims: [],
  official_summary: null,
};

// ──────────────────────────────────────────────────────────────────
// Stage 46 — 독립형 게임 도메인 타입
// (Stage 45 마이그레이션 20260707000000_*.sql 의 7테이블 + 8 RPC 응답)
// ──────────────────────────────────────────────────────────────────

export type StoryStatKey =
  | "hp"
  | "focus"
  | "skill"
  | "guard"
  | "grit"
  | "respect";

export type StorySceneType =
  | "dialogue"
  | "choice"
  | "battle"
  | "node_move"
  | "ending";

export type StorySceneScope = "prologue" | "chapter";

export interface StorySceneDialoguePayload {
  speaker: string;
  body: string;
  portrait?: string | null;
  bgm_hint?: string | null;
  reward_grant?: Record<string, unknown>;
}

export interface StorySceneChoiceOption {
  label: string;
  hint?: string;
  stat_changes?: Partial<Record<StoryStatKey, number>>;
  inventory_grants?: Array<{ card_code: string; count?: number } | string>;
  route_choice?: string;
  next_scene: number;
}

export interface StorySceneChoicePayload {
  prompt: string;
  speaker?: string;
  choices: StorySceneChoiceOption[];
}

export interface StorySceneBattlePayload {
  enemy_code: string;
  intro_line?: string;
  victory_line?: string;
  defeat_line?: string;
  reward_override?: {
    story_xp?: number;
    ring_coins?: number;
    card_code?: string;
  };
}

export interface StorySceneNodeMovePayload {
  from_node_code: string;
  to_node_code: string;
  transition_message?: string;
  animation_hint?: string;
}

export interface StoryEndingCutsceneBlock {
  type: "narration" | "image_caption" | "credits" | "dialogue" | "image";
  speaker?: string;
  body?: string;
  text?: string;
  background?: string;
  alt?: string;
  theme?: string;
}

export interface StorySceneEndingPayload {
  ending_code: string;
  title: string;
  subtitle?: string;
  cutscene_blocks: StoryEndingCutsceneBlock[];
  reward_summary: {
    story_xp?: number;
    ring_coins?: number;
    real_gems_first_time?: number;
    title?: string;
    card_code?: string;
    badge_code?: string;
  };
}

export type StoryScenePayload =
  | StorySceneDialoguePayload
  | StorySceneChoicePayload
  | StorySceneBattlePayload
  | StorySceneNodeMovePayload
  | StorySceneEndingPayload;

export interface StoryScene {
  id: string;
  scope: StorySceneScope;
  route_id: string | null;
  chapter_id: string | null;
  scene_index: number;
  scene_type: StorySceneType;
  payload: StoryScenePayload;
  next_scene_index: number | null;
  next_scene_victory: number | null;
  next_scene_defeat: number | null;
  active: boolean;
  metadata: Record<string, unknown>;
}

export interface StoryEnemy {
  code: string;
  name: string;
  description: string | null;
  hp: number;
  attack: number;
  defense: number;
  pattern_code: string;
  pattern_metadata: Record<string, unknown>;
  weakness: Record<string, number | boolean>;
  reward_story_xp: number;
  reward_ring_coins: number;
  reward_card_code: string | null;
  is_boss: boolean;
}

export type StoryCardRarity = "common" | "rare" | "epic" | "ending";

export interface StoryCard {
  code: string;
  name: string;
  description: string;
  effect_code: string | null;
  effect_metadata: Record<string, unknown>;
  is_consumable: boolean;
  rarity: StoryCardRarity;
}

export interface StoryBattleState {
  enemy_code: string;
  enemy_hp: number;
  enemy_max_hp: number;
  enemy_attack?: number;
  enemy_defense?: number;
  pattern_code?: string;
  pattern_metadata?: Record<string, unknown>;
  turn: number;
  last_command: string | null;
  card_used: boolean;
  osam_advice_used: boolean;
  pattern_state?: Record<string, unknown>;
  chapter_id?: string | null;
}

export interface StoryPlayerStats {
  user_id: string;
  active_route_code: string | null;
  prologue_completed: boolean;
  hp: number;
  hp_max: number;
  focus: number;
  focus_max: number;
  skill: number;
  skill_max: number;
  guard: number;
  guard_max: number;
  grit: number;
  grit_max: number;
  respect: number;
  respect_max: number;
  story_xp: number;
  ring_coins: number;
  earned_titles: string[];
  earned_endings: string[];
  earned_badges: string[];
  battle_state: StoryBattleState | null;
  last_played_at: string | null;
}

export interface StoryInventoryItem {
  card_code: string;
  count: number;
  first_acquired_at: string;
}

export interface StorySceneProgress {
  route_id: string;
  chapter_id: string | null;
  current_scene_index: number;
  completed_chapter_codes: string[];
  ending_reached: boolean;
  ending_code: string | null;
  play_count: number;
  first_clear_at: string | null;
  last_played_at: string | null;
}

export interface StoryEndingClaim {
  route_id: string;
  ending_code: string;
  story_xp_granted: number;
  ring_coins_granted: number;
  real_gems_granted: number;
  reward_title: string | null;
  reward_card_code: string | null;
  reward_badge_code: string | null;
  claimed_at: string;
}

// ── RPC 응답 타입 ──────────────────────────────────────────────

export interface StorySessionStartResult {
  success: boolean;
  stats: StoryPlayerStats;
  active_route_code: string | null;
  prologue_completed: boolean;
}

export interface SceneProgressResult {
  success: boolean;
  scene_id?: string;
  scene_type?: StorySceneType;
  scene_index?: number;
  payload?: StoryScenePayload;
  next_scene_index: number | null;
  next_scene_victory?: number | null;
  next_scene_defeat?: number | null;
  reason?: string;
}

export interface ChoiceApplyResult {
  success: boolean;
  next_scene_index: number;
  route_choice?: string | null;
  stat_changes?: Partial<Record<StoryStatKey, number>>;
  inventory_grants?: string[];
}

export interface BattleStartResult {
  success: boolean;
  enemy: StoryEnemy;
  player_stats: StoryPlayerStats;
  battle_state: StoryBattleState;
}

export type BattleCommand =
  | "jab"
  | "guard"
  | "footwork"
  | "counter"
  | "osam_advice"
  | "use_card";

export interface BattleActionLogEntry {
  actor: "player" | "enemy" | "osam";
  line: string;
  damage?: number;
}

export interface BattleCommandResult {
  success: boolean;
  status: "ongoing" | "victory" | "defeat";
  player_hp: number;
  enemy_hp: number;
  focus_remaining: number;
  reward_story_xp?: number;
  reward_ring_coins?: number;
  reward_card_code?: string | null;
  battle_state: StoryBattleState | null;
  reason?: string;
  // 클라이언트 측에서 만든 액션 로그/내레이션 (RPC 가 비워둘 수 있어 optional)
  action_log?: BattleActionLogEntry[];
  narration?: string;
}

export interface CardClaimResult {
  success: boolean;
  card_code: string;
  count: number;
  card?: StoryCard;
}

export interface EndingCompleteResult {
  success: boolean;
  already_claimed: boolean;
  story_xp_granted: number;
  ring_coins_granted: number;
  real_gems_granted: number;
  reward_title: string | null;
  reward_card_code: string | null;
  reward_badge_code: string | null;
}

export interface RouteResetResult {
  success: boolean;
  route_id: string;
}
