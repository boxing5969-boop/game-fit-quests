/**
 * 153 QUEST — 챔피언 일기 hook.
 *
 * submit_champion_journal_entry RPC 래퍼 + 최근 일기 조회.
 * 하루 최초 작성에만 보상이 지급되고, 추가 작성은 기록만 저장된다.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  getRecentChampionJournalEntries,
  submitChampionJournalEntry,
  type ChampionJournalEntryRow,
  type JournalEntryResult,
  type SubmitJournalInput,
} from "@/services/boxingEngagementService";

export const CHAMPION_JOURNAL_KEY = ["champion-journal"] as const;

export function useSubmitChampionJournalEntry() {
  const qc = useQueryClient();

  return useMutation<JournalEntryResult, Error, SubmitJournalInput>({
    mutationFn: submitChampionJournalEntry,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boxing-engagement"] });
      qc.invalidateQueries({ queryKey: ["champion-journal"] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export function useRecentChampionJournalEntries(limit = 3, enabled = true) {
  const { user } = useAuth();

  return useQuery<ChampionJournalEntryRow[]>({
    queryKey: [...CHAMPION_JOURNAL_KEY, "recent", user?.id ?? "anon", limit],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    queryFn: () => getRecentChampionJournalEntries(limit),
  });
}
