/**
 * 🎥 스파링 영상 1차(유튜브) — 서버 함수 부르기 (2026-11-25 · docs/features/64-스파링-영상.md)
 *
 * 권한은 서버(sparvid_* — supabase/migrations/20261125195550_sparring_video_v1.sql)가 본다:
 *   · 코치 · 지점장(그 지점) — 고르기 목록 · 경기 시작/끝 · 하루 경기 · 영상 붙이기/내리기 · 피드백 · 녹화 노트북 열쇠
 *   · 회원 — 내가 나온 영상 · 그 영상 피드백 · 커뮤니티 공개 켜기/끄기
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FilmBlock, VideoProvider } from "@/lib/sparringVideo";

type RpcError = { message?: string; code?: string } | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 새 함수(2026-11-25)는 자동 생성 타입에 아직 없다
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args) as Promise<{ data: unknown; error: RpcError }>;

/** 서버가 보낸 우리말 오류는 그대로, 아니면 기본 문구 (함수가 아직 없거나 영어 오류) */
const fail = (error: RpcError, fallback: string): never => {
  const msg = (error?.message ?? "").replace(/^.*?ERROR:\s*/, "");
  throw new Error(/[가-힣]/.test(msg) ? msg : fallback);
};

async function call<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) fail(error, fallback);
  return data as T;
}

export const SPARVID_KEY = ["153sparvid"] as const;

// ── 회원 ──────────────────────────────────────────────────────
export interface MyVideo {
  video_id: string;
  kind: "sparring" | "mitt" | "other";
  provider: VideoProvider;
  external_id: string;
  title: string | null;
  recorded_at: string;
  branch: string;
  match_code: string | null;
  rounds: number | null;
  opponent_name: string | null;
  my_share_ok: boolean;
  others_share_ok: boolean | null;
  comment_count: number;
  last_comment_at: string | null;
}

export const useMySparringVideos = (enabled: boolean) =>
  useQuery({
    queryKey: [...SPARVID_KEY, "mine"],
    enabled,
    staleTime: 60_000,
    queryFn: () => call<MyVideo[]>("sparvid_my_videos", { _limit: 50 }, "영상을 불러오지 못했어요"),
  });

export const setVideoShare = (videoId: string, ok: boolean) =>
  call<{ share_ok: boolean }>("sparvid_set_share", { _video_id: videoId, _ok: ok }, "바꾸지 못했어요");

// ── 피드백 ────────────────────────────────────────────────────
export interface VideoComment {
  id: string;
  t_sec: number | null;
  body: string;
  kind: "coach" | "ai_draft";
  status: "draft" | "published" | "hidden";
  author: string;
  mine: boolean;
  created_at: string;
}

export const useVideoComments = (videoId: string | null) =>
  useQuery({
    queryKey: [...SPARVID_KEY, "comments", videoId],
    enabled: !!videoId,
    queryFn: () =>
      call<{ staff: boolean; comments: VideoComment[] }>("sparvid_video_comments", { _video_id: videoId }, "피드백을 불러오지 못했어요"),
  });

export const addVideoComment = (videoId: string, tSec: number | null, body: string) =>
  call<{ id: string }>("sparvid_comment_add", { _video_id: videoId, _t_sec: tSec, _body: body }, "피드백을 남기지 못했어요");

export const setVideoComment = (commentId: string, action: "approve" | "hide") =>
  call<{ status: string }>("sparvid_comment_set", { _comment_id: commentId, _action: action }, "바꾸지 못했어요");

export const removeVideo = (videoId: string, reason: string) =>
  call<{ status: string }>("sparvid_video_remove", { _video_id: videoId, _reason: reason }, "영상을 내리지 못했어요");

// ── 코치: 스파링 기록 ──────────────────────────────────────────
export interface PickPerson {
  user_id: string;
  name: string;
  checked_in_at: string | null;
  is_staff: boolean;
  consent: string | null;
  film_block: string | null;
}

export const usePickList = (q: string, enabled: boolean) =>
  useQuery({
    queryKey: [...SPARVID_KEY, "pick", q],
    enabled,
    staleTime: 30_000,
    queryFn: () =>
      call<{ branch: string; people: PickPerson[] }>("sparvid_pick_list", { _q: q || null }, "출석한 회원을 불러오지 못했어요"),
  });

export interface MatchStarted {
  id: string;
  match_code: string;
  seq: number;
  film_ok: boolean;
  a_name: string;
  b_name: string;
  a_block: string | null;
  b_block: string | null;
}

export const startMatch = (a: string, b: string, rounds: number, roundSec: number, restSec: number) =>
  call<MatchStarted>(
    "sparvid_match_start",
    { _a: a, _b: b, _rounds: rounds, _round_sec: roundSec, _rest_sec: restSec },
    "경기를 시작하지 못했어요",
  );

export const endMatch = (matchId: string, cancel = false) =>
  call<{ status: string }>("sparvid_match_end", { _match_id: matchId, _cancel: cancel }, "경기를 끝내지 못했어요");

export interface DayMatch {
  id: string;
  match_code: string;
  seq: number;
  status: "live" | "done" | "cancelled";
  started_at: string;
  ended_at: string | null;
  ends_at_est: string;
  rounds: number;
  round_sec: number;
  rest_sec: number;
  film_ok: boolean;
  film_block: FilmBlock | null;
  a_id: string;
  a_name: string;
  b_id: string;
  b_name: string;
  video_id: string | null;
  video_provider: VideoProvider | null;
  video_external_id: string | null;
  comment_count: number;
}

export const useDayMatches = (enabled: boolean) =>
  useQuery({
    queryKey: [...SPARVID_KEY, "day"],
    enabled,
    staleTime: 15_000,
    queryFn: () =>
      call<{ branch: string; date: string; branch_code: string; matches: DayMatch[] }>(
        "sparvid_day_matches",
        {},
        "오늘 경기를 불러오지 못했어요",
      ),
  });

export const attachVideo = (matchId: string, ref: string) =>
  call<{ video_id: string; external_id: string; new: boolean }>(
    "sparvid_attach_video",
    { _match_id: matchId, _ref: ref },
    "영상을 붙이지 못했어요",
  );

export const createRecorderKey = (label: string) =>
  call<{ token: string; branch: string; branch_code: string }>(
    "sparvid_recorder_key_create",
    { _label: label },
    "열쇠를 만들지 못했어요",
  );
