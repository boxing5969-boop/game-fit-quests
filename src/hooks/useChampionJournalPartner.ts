/**
 * 153 QUEST — 챔피언 일기 파트너 피드 + 댓글 hooks.
 *
 * 파트너 정의 (DB is_journal_partner):
 *   · 코너맨 active 페어
 *   · 최근 30일 양방향 cheer
 *
 * 보호 원칙: 공식 1~40 / 공식 XP / wallet 변경 0건.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  addJournalComment,
  deleteJournalComment,
  getPartnerJournalFeed,
  listJournalComments,
  type JournalCommentRow,
  type PartnerJournalFeedRow,
} from "@/services/championJournalPartnerService";

export const PARTNER_JOURNAL_KEY = ["partner-journal"] as const;

export function usePartnerJournalFeed(limit = 10, enabled = true) {
  const { user } = useAuth();
  return useQuery<PartnerJournalFeedRow[]>({
    queryKey: [...PARTNER_JOURNAL_KEY, "feed", user?.id ?? "anon", limit],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    queryFn: () => getPartnerJournalFeed(limit),
  });
}

export function useJournalComments(entryId: string | null, enabled = true) {
  const { user } = useAuth();
  return useQuery<JournalCommentRow[]>({
    queryKey: [...PARTNER_JOURNAL_KEY, "comments", entryId ?? "none"],
    enabled: enabled && !!user?.id && !!entryId,
    staleTime: 15_000,
    queryFn: () => listJournalComments(entryId as string),
  });
}

export function useAddJournalComment(entryId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => {
      if (!entryId) throw new Error("일기를 찾을 수 없습니다.");
      return addJournalComment(entryId, content);
    },
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [...PARTNER_JOURNAL_KEY, "comments", entryId ?? "none"],
      });
      // 피드의 comment_count 도 갱신되도록
      qc.invalidateQueries({ queryKey: [...PARTNER_JOURNAL_KEY, "feed"] });
    },
  });
}

export function useDeleteJournalComment(entryId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteJournalComment(commentId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: [...PARTNER_JOURNAL_KEY, "comments", entryId ?? "none"],
      });
      qc.invalidateQueries({ queryKey: [...PARTNER_JOURNAL_KEY, "feed"] });
    },
  });
}
