/**
 * 153 스토리 RPG service (단계 35).
 *
 * Migration 20260705000000_boxing_story_rpg_foundation.sql 의 RPC 래퍼.
 *
 * 보호 원칙(절대):
 *   · levels / missions / mission_submissions / member_progress 미수정
 *   · 공식 XP 미지급. 파이트 머니는 RPC 내부 grant_gems 경유.
 *   · 본 service 의 어떤 경로도 wallet 을 직접 update 하지 않는다.
 *   · 본 service 의 어떤 경로도 ChatAssistant / chat-assistant Edge 를 호출하지 않는다.
 *
 * 타입 주의:
 *   types.ts(자동 생성) 에 boxing_story_* 가 아직 없을 수 있으므로 rpc 호출은 cast 로 좁게 우회한다.
 *   향후 supabase gen types 갱신 시 cast 만 제거.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  EMPTY_STORY_RPG_STATE,
  type StoryChooseRouteResult,
  type StoryRewardResult,
  type StoryRpgState,
  type StorySyncResult,
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

const STORY_ERROR_MAP: ReadonlyArray<{ match: string; ko: string }> = [
  { match: "auth required", ko: "로그인이 필요합니다." },
  { match: "route not available", ko: "선택할 수 없는 루트입니다." },
  { match: "chapter not available", ko: "선택할 수 없는 챕터입니다." },
];

function mapStoryError(message: string | undefined): string {
  if (!message) return "스토리 처리 중 오류가 발생했습니다.";
  const hit = STORY_ERROR_MAP.find((e) => message.includes(e.match));
  return hit ? hit.ko : message;
}

// ──────────────────────────────────────────────────────────────────
// A. get_my_story_rpg_state
// ──────────────────────────────────────────────────────────────────
export async function getMyStoryRpgState(): Promise<StoryRpgState> {
  const { data, error } = await sbRpc<StoryRpgState>("get_my_story_rpg_state");
  if (error) {
    // 앱 전체를 깨뜨리지 않게 빈 상태 fallback (UI 가 routes [] 로 그릴 수 있게).
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

// ──────────────────────────────────────────────────────────────────
// B. choose_story_route
// ──────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────
// C. change_story_route
// ──────────────────────────────────────────────────────────────────
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
// D. sync_story_chapter_progress
// ──────────────────────────────────────────────────────────────────
export async function syncStoryChapterProgress(
  routeCode: string,
): Promise<StorySyncResult | null> {
  const { data, error } = await sbRpc<StorySyncResult>(
    "sync_story_chapter_progress",
    { p_route_code: routeCode },
  );
  if (error) {
    if (import.meta.env.DEV) {
      console.warn("[storyRpg] sync_story_chapter_progress failed:", error.message);
    }
    return null;
  }
  return data;
}

// ──────────────────────────────────────────────────────────────────
// E. claim_story_chapter_reward
// ──────────────────────────────────────────────────────────────────
export async function claimStoryChapterReward(
  chapterId: string,
): Promise<StoryRewardResult> {
  const { data, error } = await sbRpc<StoryRewardResult>(
    "claim_story_chapter_reward",
    { p_chapter_id: chapterId },
  );
  if (error) throw new Error(mapStoryError(error.message));
  if (!data) throw new Error("보상 수령에 실패했습니다.");
  return data;
}
