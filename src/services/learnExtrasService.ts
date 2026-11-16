// 🎬 영상으로 배우기 — 153플레이에 모아 둔 153복싱짐 영상 읽기 (2026-11-16 · lib/learnExtras)
//   boxing_programs 의 우리 채널 줄만(백 편 남짓) · 읽기만 · 10분 기억. 표가 없거나 칸이 다른 DB(옛 DB 미리보기)면 빈 목록 — 칸은 예전처럼.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OWN_CHANNEL, type LearnProgramSource } from "@/lib/learnExtras";

const COLS = "id, yt_id, title, league, tags, train_type, platform, summary, channel, is_active, visibility";

export function useLearnPrograms(enabled = true) {
  return useQuery({
    queryKey: ["153learn", "programs"],
    enabled,
    staleTime: 10 * 60_000,
    retry: 1,
    queryFn: async (): Promise<LearnProgramSource[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("boxing_programs")
        .select(COLS)
        .eq("channel", OWN_CHANNEL)
        .eq("is_active", true)
        .order("id", { ascending: true })
        .limit(500);
      if (error) return [];
      return (data ?? []) as LearnProgramSource[];
    },
  });
}
