/**
 * 153 QUEST — 챔피언 일기 파트너 피드 + 댓글 서비스.
 *
 * 보호 원칙:
 *   · 공식 1~40 levels/missions/member_progress 일절 미수정
 *   · grant_gems 직접 호출 0건 — 댓글은 보상 없음
 *   · ChatAssistant / 새 AI 챗박스 미사용
 *
 * 의존 RPC:
 *   · get_partner_journal_feed
 *   · list_journal_comments
 *   · add_journal_comment
 *   · delete_journal_comment
 */

import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

type SbResult<T> = { data: T | null; error: { message: string } | null };

async function sbRpc<T>(
  name: string,
  args?: Record<string, unknown>,
): Promise<SbResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(name, args);
}

const COMMENT_ERROR_MAP: ReadonlyArray<{ match: string; ko: string }> = [
  { match: "auth required", ko: "로그인이 필요합니다." },
  { match: "entry not found", ko: "일기를 찾을 수 없습니다." },
  {
    match: "not authorized to view comments",
    ko: "이 일기의 댓글을 볼 권한이 없습니다.",
  },
  {
    match: "코너맨 또는 세컨드 응원 파트너만",
    ko: "코너맨 또는 세컨드 응원 파트너만 댓글을 남길 수 있습니다.",
  },
  { match: "댓글 내용을 입력", ko: "댓글 내용을 입력해주세요." },
  { match: "댓글은 500자", ko: "댓글은 500자 이하로 작성해주세요." },
  { match: "본인 댓글만", ko: "본인 댓글만 삭제할 수 있습니다." },
];

function throwKo(err: unknown): never {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  for (const { match, ko } of COMMENT_ERROR_MAP) {
    if (msg.includes(match)) throw new Error(ko);
  }
  throw new Error(translateError(err));
}

// ──────────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────────

export type JournalPartnerRelation = "cornerman" | "second";

export interface PartnerJournalFeedRow {
  id: string;
  user_id: string;
  display_name: string;
  prompt: string;
  content: string;
  mood: string | null;
  created_at: string;
  comment_count: number;
  relation: JournalPartnerRelation;
}

export interface JournalCommentRow {
  id: string;
  entry_id: string;
  commenter_user_id: string;
  commenter_name: string;
  content: string;
  created_at: string;
  is_mine: boolean;
}

export interface AddJournalCommentResult {
  success: true;
  comment_id: string;
  message: string;
}

// ──────────────────────────────────────────────────────────────────
// RPC 래퍼
// ──────────────────────────────────────────────────────────────────

export async function getPartnerJournalFeed(
  limit = 10,
): Promise<PartnerJournalFeedRow[]> {
  const { data, error } = await sbRpc<PartnerJournalFeedRow[]>(
    "get_partner_journal_feed",
    { p_limit: limit },
  );
  if (error) throwKo(error);
  return data ?? [];
}

export async function listJournalComments(
  entryId: string,
): Promise<JournalCommentRow[]> {
  const { data, error } = await sbRpc<JournalCommentRow[]>(
    "list_journal_comments",
    { p_entry_id: entryId },
  );
  if (error) throwKo(error);
  return data ?? [];
}

export async function addJournalComment(
  entryId: string,
  content: string,
): Promise<AddJournalCommentResult> {
  const { data, error } = await sbRpc<AddJournalCommentResult[]>(
    "add_journal_comment",
    { p_entry_id: entryId, p_content: content },
  );
  if (error) throwKo(error);
  // RETURNS TABLE 은 배열로 반환됨
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.success !== true) {
    throw new Error("댓글을 저장하지 못했습니다.");
  }
  return row;
}

export async function deleteJournalComment(
  commentId: string,
): Promise<{ success: true; message: string }> {
  const { data, error } = await sbRpc<{ success: true; message: string }[]>(
    "delete_journal_comment",
    { p_comment_id: commentId },
  );
  if (error) throwKo(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.success !== true) {
    throw new Error("댓글을 삭제하지 못했습니다.");
  }
  return row;
}
