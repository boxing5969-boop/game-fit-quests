/**
 * 153 커뮤니티 — 모두의 피드 · 153 반응 (2026-10-15 대표님: "커뮤니티 개편안대로 — 반응 이름은 153").
 *
 * 서버(supabase/migrations/20261015130000_community_feed_153.sql)가 볼 수 있는 글만 내려준다.
 *   · get_community_feed       — 코치 이번 주 목표(고정) · 승급 축하(고정) · 오늘 운동 한 줄 · 오늘도 한 판(출석)
 *   · toggle_community_153     — 153 누르기/취소 (내 글에는 못 누름)
 *   · set_journal_entry_options — 한 줄 공개 범위(지점 모두/짝꿍만) + 사진
 *   · post_weekly_goal · hide_community_entry · report_community_entry · set_community_auto_post
 * 153·댓글·목표 글에는 보상이 없다. 공식 레벨업과 무관.
 */
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import { compressImage } from "@/lib/imageCompression";

type SbResult<T> = { data: T | null; error: { message: string } | null };

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = (await (supabase as any).rpc(name, args)) as SbResult<T>;
  if (error) {
    // 서버가 한국어로 보낸 안내는 그대로, 나머지는 공통 번역
    const msg = error.message ?? "";
    throw new Error(/[가-힣]/.test(msg) ? msg : translateError(error));
  }
  return data as T;
}

export type FeedItemType = "goal" | "promotion" | "journal" | "checkin";
export type ReactTarget = "journal" | "checkin" | "promotion";

export interface FeedItem {
  type: FeedItemType;
  id: string;
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  isStaff: boolean;
  staffTitle: string | null;
  league: string;
  level: number;
  at: string;
  pinned: boolean;
  prompt: string | null;
  content: string | null;
  mood: string | null;
  photoUrl: string | null;
  visibility: "branch" | "partners" | null;
  newbie: boolean;
  promoRank: string | null;
  promoLevel: number | null;
  isMine: boolean;
  comments: number;
  count153: number;
  reacted: boolean;
}

export interface CommunityFeed {
  success: boolean;
  branch: string | null;
  is_staff: boolean;
  items: FeedItem[];
}

/** 피드 글(목표 포함)의 153 대상 종류 */
export const reactTargetOf = (t: FeedItemType): ReactTarget => (t === "goal" ? "journal" : t);

export const getCommunityFeed = (limit = 40) => rpc<CommunityFeed>("get_community_feed", { p_limit: limit });

export const toggle153 = (type: ReactTarget, id: string) =>
  rpc<{ success: boolean; reacted: boolean; count153: number }>("toggle_community_153", { p_type: type, p_id: id });

export const setJournalEntryOptions = (entryId: string, visibility: "branch" | "partners", photoUrl: string | null) =>
  rpc<{ success: boolean }>("set_journal_entry_options", {
    p_entry_id: entryId,
    p_visibility: visibility,
    p_photo_url: photoUrl,
  });

export const postWeeklyGoal = (content: string) => rpc<{ success: boolean; entry_id: string }>("post_weekly_goal", { p_content: content });

export const hideCommunityEntry = (entryId: string) => rpc<{ success: boolean }>("hide_community_entry", { p_entry_id: entryId });

export const reportCommunityEntry = (entryId: string, reason: string) =>
  rpc<{ success: boolean }>("report_community_entry", { p_entry_id: entryId, p_reason: reason });

export const setCommunityAutoPost = (on: boolean) => rpc<{ success: boolean; on: boolean }>("set_community_auto_post", { p_on: on });

export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** 한 줄에 붙일 사진 — 가장 긴 변 1280px JPEG 로 줄여 community/{uid}/… 에 올리고 공개 주소를 돌려준다 */
export async function uploadCommunityPhoto(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 올릴 수 있어요");
  if (file.size > PHOTO_MAX_BYTES) throw new Error("10MB 이하 사진만 올릴 수 있어요");
  const blob = await compressImage(file, 1280, 0.8);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from("community").upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("사진을 올리지 못했어요. 잠시 후 다시 시도해 주세요");
  return supabase.storage.from("community").getPublicUrl(path).data.publicUrl;
}
