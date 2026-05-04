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
