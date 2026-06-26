// 50분 수업 구성(세션 블록) 데이터 소스.
// DB(session_templates)에 해당 레벨 값이 있으면 그걸 쓰고, 없으면 하드코딩 폴백을 사용한다.
// 마스터가 편집·저장하면 DB 행이 생기고, 모든 회원이 같은 행을 읽어 즉시 반영된다.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SessionBlock } from "@/data/whiteLevel1Data";

export function useSessionTemplate(levelKey: string | null, fallback: SessionBlock[] | null) {
  const q = useQuery({
    queryKey: ["session_template", levelKey],
    enabled: !!levelKey,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("session_templates")
        .select("blocks")
        .eq("level_key", levelKey)
        .maybeSingle();
      return (data?.blocks as SessionBlock[]) ?? null;
    },
  });

  const blocks = (q.data ?? fallback) ?? null;
  return { blocks, isCustom: !!q.data, loading: q.isLoading, refetch: q.refetch };
}
