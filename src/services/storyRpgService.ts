/**
 * 153 스토리 RPG service (단계 35 + 46).
 *
 * Stage 45 마이그레이션 (20260707000000_boxing_story_rpg_independent_game.sql) 의
 * 신규 RPC 8 + 마스터 reader 4 + 기존 RPC 3 (chooseStoryRoute / changeStoryRoute / getMyStoryRpgState).
 *
 * 보호 원칙(절대):
 *   · levels / missions / mission_submissions / member_progress 미수정.
 *   · 공식 XP 미지급. 파이트 머니는 RPC 내부 grant_gems 경유.
 *   · wallet 직접 update 금지.
 *   · ChatAssistant / chat-assistant Edge 호출 금지.
 *
 * 타입 우회:
 *   types.ts(자동 생성) 에 boxing_story_* 가 없을 수 있어 sbRpc / sbFrom 좁은 cast 사용.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_STORY_RPG_STATE,
  type BattleCommand,
  type BattleCommandResult,
  type BattleStartResult,
  type CardClaimResult,
  type ChapterCompleteResult,
  type ChoiceApplyResult,
  type EndingCompleteResult,
  type RouteResetResult,
  type SceneProgressResult,
  type StoryCard,
  type StoryChooseRouteResult,
  type StoryEnemy,
  type StoryInventoryItem,
  type StoryPlayerStats,
  type StoryRpgState,
  type StorySessionStartResult,
} from "@/types/storyRpg";

interface SbResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

async function sbRpc<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<SbResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(name, args ?? {});
}

function sbFrom(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table);
}

const STORY_ERROR_MAP: ReadonlyArray<{ match: string; ko: string }> = [
  { match: "auth required", ko: "로그인이 필요합니다." },
  { match: "route not available", ko: "선택할 수 없는 루트입니다." },
  { match: "chapter not available", ko: "선택할 수 없는 챕터입니다." },
  { match: "no_active_battle", ko: "현재 진행 중인 전투가 없습니다." },
  { match: "no player stats", ko: "게임 세션이 시작되지 않았습니다." },
  { match: "invalid command", ko: "지원하지 않는 명령입니다." },
  { match: "invalid hp deltas", ko: "잘못된 전투 데이터입니다." },
  { match: "not enough focus", ko: "집중력이 부족합니다." },
  { match: "invalid_scene", ko: "잘못된 씬 인덱스입니다." },
  { match: "scene_not_found", ko: "씬을 찾을 수 없습니다." },
  { match: "scene not found", ko: "씬을 찾을 수 없습니다." },
  { match: "ending_already_claimed", ko: "이미 받은 엔딩 보상입니다." },
  { match: "ending scene not found", ko: "엔딩 씬을 찾을 수 없습니다." },
  { match: "invalid_choice", ko: "유효하지 않은 선택지입니다." },
  { match: "choice index out of range", ko: "유효하지 않은 선택지입니다." },
  { match: "choice scene not available", ko: "유효하지 않은 선택지 씬입니다." },
  { match: "stat_clamp_error", ko: "능력치가 한계에 도달했습니다." },
  { match: "card not available", ko: "카드를 찾을 수 없습니다." },
  { match: "card_not_found", ko: "카드를 찾을 수 없습니다." },
  { match: "enemy not available", ko: "적을 찾을 수 없습니다." },
  { match: "battle_lock", ko: "전투 진행 중에는 이 행동을 할 수 없습니다." },
  { match: "chapter not found", ko: "챕터 정보를 찾을 수 없습니다." },
];

function mapStoryError(message: string | undefined): string {
  if (!message) return "스토리 처리 중 오류가 발생했습니다.";
  const hit = STORY_ERROR_MAP.find((e) => message.includes(e.match));
  return hit ? hit.ko : message;
}

// ──────────────────────────────────────────────────────────────────
// 기존 보존 — Stage 35 RPC
// ──────────────────────────────────────────────────────────────────

export async function getMyStoryRpgState(): Promise<StoryRpgState> {
  const { data, error } = await sbRpc<StoryRpgState>("get_my_story_rpg_state");
  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[storyRpg] get_my_story_rpg_state failed:", error.message);
    }
    return EMPTY_STORY_RPG_STATE;
  }
  if (!data) return EMPTY_STORY_RPG_STATE;
  return {
    active_route_id: data.active_route_id ?? null,
    routes: data.routes ?? [],
    chapters: data.chapters ?? [],
    nodes: data.nodes ?? [],
    dialogues: data.dialogues ?? [],
    progress: data.progress ?? [],
    reward_claims: data.reward_claims ?? [],
    official_summary: data.official_summary ?? null,
  };
}

export async function chooseStoryRoute(
  routeCode: string,
): Promise<StoryChooseRouteResult> {
  const { data, error } = await sbRpc<StoryChooseRouteResult>(
    "choose_story_route",
    { p_route_code: routeCode },
  );
  if (error) throw new Error(mapStoryError(error.message));
  if (!data) throw new Error("스토리 루트 선택에 실패했습니다.");
  return data;
}

export async function changeStoryRoute(
  routeCode: string,
): Promise<StoryChooseRouteResult> {
  const { data, error } = await sbRpc<StoryChooseRouteResult>(
    "change_story_route",
    { p_route_code: routeCode },
  );
  if (error) throw new Error(mapStoryError(error.message));
  if (!data) throw new Error("스토리 루트 변경에 실패했습니다.");
  return data;
}

// ──────────────────────────────────────────────────────────────────
// Deprecated — Stage 45 에서 RPC 가 DROP 됨. 호출자 정리되면 함수 자체 제거.
// ──────────────────────────────────────────────────────────────────

/** @deprecated Stage 45 에서 RPC drop 됨. UI 정리 후 제거 예정. */
export async function syncStoryChapterProgress(
  _routeCode: string,
): Promise<null> {
  if (import.meta.env.DEV) {
    console.warn("[storyRpg] syncStoryChapterProgress is deprecated (Stage 45)");
  }
  return null;
}

/** @deprecated Stage 45 에서 RPC drop 됨. UI 정리 후 제거 예정. */
export async function claimStoryChapterReward(
  _chapterId: string,
): Promise<never> {
  throw new Error("deprecated");
}

// ──────────────────────────────────────────────────────────────────
// Stage 46 — 신규 RPC 8개
// ──────────────────────────────────────────────────────────────────

export async function startStorySession(): Promise<StorySessionStartResult> {
  const { data, error } = await sbRpc<StorySessionStartResult>("start_story_session");
  if (error) throw new Error(mapStoryError(error.message));
  if (!data) throw new Error("게임 세션 시작에 실패했습니다.");
  return data;
}

export async function progressToScene(
  routeId: string | null,
  chapterId: string | null,
  sceneIndex: number,
): Promise<SceneProgressResult> {
  const { data, error } = await sbRpc<SceneProgressResult>("progress_to_scene", {
    p_route_id: routeId,
    p_chapter_id: chapterId,
    p_scene_index: sceneIndex,
  });
  if (error) throw new Error(mapStoryError(error.message));
  if (!data) throw new Error("씬 이동에 실패했습니다.");
  return data;
}

export async function applyChoice(
  sceneId: string,
  choiceIndex: number,
): Promise<ChoiceApplyResult> {
  const { data, error } = await sbRpc<ChoiceApplyResult>("apply_choice", {
    p_scene_id: sceneId,
    p_choice_index: choiceIndex,
  });
  if (error) throw new Error(mapStoryError(error.message));
  if (!data) throw new Error("선택 처리에 실패했습니다.");
  return data;
}

export async function startBattle(
  enemyCode: string,
  chapterId: string | null,
): Promise<BattleStartResult> {
  const { data, error } = await sbRpc<BattleStartResult>("start_battle", {
    p_enemy_code: enemyCode,
    p_chapter_id: chapterId,
  });
  if (error) throw new Error(mapStoryError(error.message));
  if (!data) throw new Error("전투 시작에 실패했습니다.");
  return data;
}

export async function submitPlayerCommand(
  command: BattleCommand,
  targetData: Record<string, unknown> = {},
): Promise<BattleCommandResult> {
  const { data, error } = await sbRpc<BattleCommandResult>(
    "submit_player_command",
    {
      p_command: command,
      p_target_data: targetData,
    },
  );
  if (error) throw new Error(mapStoryError(error.message));
  if (!data) throw new Error("명령 처리에 실패했습니다.");
  return data;
}

export async function claimCardReward(
  cardCode: string,
  source: "chapter_clear" | "choice" | "hidden_scene" | "enemy_drop",
): Promise<CardClaimResult> {
  const { data, error } = await sbRpc<CardClaimResult>("claim_card_reward", {
    p_card_code: cardCode,
    p_source: source,
  });
  if (error) throw new Error(mapStoryError(error.message));
  if (!data) throw new Error("카드 획득에 실패했습니다.");
  return data;
}

export async function completeEnding(
  routeId: string,
  endingCode: string,
): Promise<EndingCompleteResult> {
  const { data, error } = await sbRpc<EndingCompleteResult>("complete_ending", {
    p_route_id: routeId,
    p_ending_code: endingCode,
  });
  if (error) throw new Error(mapStoryError(error.message));
  if (!data) throw new Error("엔딩 보상 처리에 실패했습니다.");
  return data;
}

export async function completeChapter(
  routeId: string,
  chapterId: string,
): Promise<ChapterCompleteResult> {
  const { data, error } = await sbRpc<ChapterCompleteResult>("complete_chapter", {
    p_route_id: routeId,
    p_chapter_id: chapterId,
  });
  if (error) throw new Error(mapStoryError(error.message));
  if (!data) throw new Error("complete_chapter 응답이 비었습니다.");
  return data;
}

export async function resetStoryRoute(
  routeId: string,
): Promise<RouteResetResult> {
  const { data, error } = await sbRpc<RouteResetResult>("reset_story_route", {
    p_route_id: routeId,
  });
  if (error) throw new Error(mapStoryError(error.message));
  if (!data) throw new Error("루트 초기화에 실패했습니다.");
  return data;
}

// ──────────────────────────────────────────────────────────────────
// Stage 46 — 마스터 데이터 reader (RLS active=true)
// ──────────────────────────────────────────────────────────────────

export async function fetchStoryEnemies(): Promise<StoryEnemy[]> {
  const { data, error } = await sbFrom("boxing_story_enemies")
    .select("*")
    .eq("active", true);
  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[storyRpg] fetchStoryEnemies failed:", error.message);
    }
    return [];
  }
  return (data ?? []) as StoryEnemy[];
}

export async function fetchStoryCards(): Promise<StoryCard[]> {
  const { data, error } = await sbFrom("boxing_story_cards")
    .select("*")
    .eq("active", true);
  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[storyRpg] fetchStoryCards failed:", error.message);
    }
    return [];
  }
  return (data ?? []) as StoryCard[];
}

export async function fetchMyInventory(): Promise<StoryInventoryItem[]> {
  const { data: userResp } = await supabase.auth.getUser();
  const uid = userResp.user?.id;
  if (!uid) return [];
  const { data, error } = await sbFrom("boxing_story_inventory")
    .select("card_code, count, first_acquired_at")
    .eq("user_id", uid);
  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[storyRpg] fetchMyInventory failed:", error.message);
    }
    return [];
  }
  return (data ?? []) as StoryInventoryItem[];
}

export async function fetchMyPlayerStats(): Promise<StoryPlayerStats | null> {
  const { data: userResp } = await supabase.auth.getUser();
  const uid = userResp.user?.id;
  if (!uid) return null;
  const { data, error } = await sbFrom("boxing_user_player_stats")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[storyRpg] fetchMyPlayerStats failed:", error.message);
    }
    return null;
  }
  return (data ?? null) as StoryPlayerStats | null;
}
