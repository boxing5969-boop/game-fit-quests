/**
 * 🎥 스파링 영상 1차(유튜브) — 서버 함수 부르기 (2026-11-25 · docs/features/64-스파링-영상.md)
 *
 * 권한은 서버(sparvid_* — supabase/migrations/20261125195550_sparring_video_v1.sql)가 본다:
 *   · 코치 · 지점장(그 지점) — 고르기 목록 · 경기 시작/끝 · 하루 경기 · 영상 붙이기/내리기 · 피드백 · 녹화 노트북 열쇠
 *   · 회원 — 내가 나온 영상 · 그 영상 피드백 · 커뮤니티 공개 켜기/끄기
 * 2026-11-26 회원 직접 올리기(20261126000204_member_video_upload.sql · 20261126001436_member_video_feedback_queue.sql):
 *   · 회원 — 비공개 저장소 member-videos 의 내 폴더에 올리고 등록 · 내가 올린 영상 지우기 · 우리 지점 영상 신고(바로 가려짐)
 *   · 코치 · 지점장 — 신고된 영상 다시 보이기/내리기 · 「피드백 요청」 목록
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MEMBER_VIDEO_BUCKET, type FilmBlock, type VideoKind, type VideoProvider } from "@/lib/sparringVideo";

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
  last_comment_at?: string | null;
  /** 회원이 올린 영상 (2026-11-26 · v2) */
  poster_path?: string | null;
  caption?: string | null;
  /** hidden = 신고로 가려짐(코치 확인 중) — 올린 사람에게만 보인다 */
  status?: "ready" | "hidden";
  is_upload?: boolean;
  want_feedback?: boolean;
}

export const useMySparringVideos = (enabled: boolean) =>
  useQuery({
    queryKey: [...SPARVID_KEY, "mine"],
    enabled,
    staleTime: 60_000,
    queryFn: () => call<MyVideo[]>("sparvid_my_videos_v2", { _limit: 60 }, "영상을 불러오지 못했어요"),
  });

export const setVideoShare = (videoId: string, ok: boolean) =>
  call<{ share_ok: boolean }>("sparvid_set_share", { _video_id: videoId, _ok: ok }, "바꾸지 못했어요");

/** 우리 지점 영상 — 같은 지점 회원 누구나(레벨 상관없이) · 영상에 나온 사람이 모두 공개에 동의한 영상만 (2026-11-25) */
export interface SharedVideo {
  video_id: string;
  kind: "sparring" | "mitt" | "other";
  provider: VideoProvider;
  external_id: string;
  title: string | null;
  recorded_at: string;
  names: string | null;
  is_mine: boolean;
  my_share_ok: boolean | null;
  poster_path?: string | null;
  caption?: string | null;
  is_upload?: boolean;
}

export const useSharedVideos = (enabled: boolean) =>
  useQuery({
    queryKey: [...SPARVID_KEY, "shared"],
    enabled,
    staleTime: 60_000,
    queryFn: () => call<SharedVideo[]>("sparvid_shared_videos_v2", { _limit: 60 }, "우리 지점 영상을 불러오지 못했어요"),
  });

// ── 회원 직접 올리기 · 신고 (2026-11-26) ───────────────────────────────
/** 비공개 저장소 서명 주소 (1시간) — 보기 권한은 저장소 정책 sparvid_can_view_object */
export async function signedUrlOf(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(MEMBER_VIDEO_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** 목록 포스터 여러 장을 한 번에 */
export const usePosterUrls = (paths: string[]) =>
  useQuery({
    queryKey: [...SPARVID_KEY, "posters", paths.join("|")],
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.storage.from(MEMBER_VIDEO_BUCKET).createSignedUrls(paths, 3600);
      const out: Record<string, string> = {};
      for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
      return out;
    },
  });

/** 파일 하나를 내 폴더에 (실패하면 화면에 보여 줄 한 줄로 던진다) */
export async function putMemberFile(path: string, blob: Blob, contentType: string): Promise<void> {
  const body = blob.type === contentType ? blob : new Blob([blob], { type: contentType });
  const up = await supabase.storage
    .from(MEMBER_VIDEO_BUCKET)
    .upload(path, body, { contentType, upsert: false, cacheControl: "3600" });
  if (up.error) {
    const m = up.error.message || "";
    if (/exceed|too large|size/i.test(m)) throw new Error("영상이 너무 커요 — 50MB까지예요");
    throw new Error(`올리지 못했어요 — 인터넷 연결을 확인하고 다시 눌러 주세요 (${m || "업로드 실패"})`);
  }
}

export interface UploadInput {
  path: string;
  poster: string | null;
  kind: VideoKind;
  caption: string;
  share: boolean;
  wantFeedback: boolean;
  othersOk: boolean;
  durationSec: number | null;
}

export const registerUpload = (u: UploadInput) =>
  call<{ video_id: string; share_ok: boolean; under14: boolean }>(
    "sparvid_upload_register",
    {
      _path: u.path,
      _poster: u.poster,
      _kind: u.kind,
      _caption: u.caption,
      _share: u.share,
      _want_feedback: u.wantFeedback,
      _others_ok: u.othersOk,
      _duration: u.durationSec,
    },
    "영상을 등록하지 못했어요",
  );

/** 내가 올린 영상 지우기 — 기록을 지운 뒤 내 폴더의 파일도 지운다 */
export async function deleteMyVideo(videoId: string): Promise<void> {
  const r = await call<{ external_id: string; poster_path: string | null }>(
    "sparvid_my_delete",
    { _video_id: videoId },
    "지우지 못했어요",
  );
  const files = [r.external_id, r.poster_path].filter((x): x is string => !!x);
  if (files.length) await supabase.storage.from(MEMBER_VIDEO_BUCKET).remove(files);
}

export const reportVideo = (videoId: string, reason: string) =>
  call<{ hidden: boolean }>("sparvid_report", { _video_id: videoId, _reason: reason }, "신고하지 못했어요");

export const moderateVideo = (videoId: string, action: "restore" | "remove") =>
  call<{ status: string }>("sparvid_moderate", { _video_id: videoId, _action: action }, "바꾸지 못했어요");

export interface ReportedVideo {
  video_id: string;
  kind: VideoKind;
  provider: VideoProvider;
  external_id: string;
  poster_path: string | null;
  caption: string | null;
  recorded_at: string;
  names: string | null;
  reasons: string[] | null;
  hidden_at: string | null;
}

export const useReported = (enabled: boolean) =>
  useQuery({
    queryKey: [...SPARVID_KEY, "reported"],
    enabled,
    staleTime: 30_000,
    retry: false,
    queryFn: () => call<ReportedVideo[]>("sparvid_reported", {}, "신고 목록을 불러오지 못했어요"),
  });

/** 코치 「피드백 요청」 — 회원이 「코치님 피드백 받기」를 켜고 올린 영상(나만 보기 포함) · 피드백 없는 것 먼저 */
export interface FeedbackRequest {
  video_id: string;
  kind: VideoKind;
  provider: VideoProvider;
  external_id: string;
  poster_path: string | null;
  caption: string | null;
  recorded_at: string;
  names: string | null;
  share_ok: boolean;
  comment_count: number;
}

export const useFeedbackRequests = (enabled: boolean) =>
  useQuery({
    queryKey: [...SPARVID_KEY, "requests"],
    enabled,
    staleTime: 30_000,
    retry: false,
    queryFn: () => call<FeedbackRequest[]>("sparvid_feedback_requests", {}, "피드백 요청을 불러오지 못했어요"),
  });

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
