import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsInHallOfFame } from "@/hooks/useRankingData";

/**
 * HoF 보상 자동 청구 훅.
 *
 * HoF 자격은 서버에서 is_caller_in_hall_of_fame() 으로 파생되므로,
 * 클라이언트는 HoF 가 확인될 때 3종 claim RPC 를 각각 한 번씩 호출한다.
 * 서버 RPC 는 (user_id, kind, period_key) UNIQUE 로 멱등화되어 있어
 * 중복 호출은 already_granted 응답만 받는다 — 실제 젬 이중 지급 없음.
 *
 * 트리거 타이밍
 *   • 홈에서 마운트되어 isInHallOfFame=true 로 관찰되는 첫 렌더
 *   • 세션당 한 번만 호출하기 위해 useRef 가드
 *
 * 상태 변화 감지 위치 메모
 *   HoF 상태는 저장된 플래그가 아니라 get_hall_of_fame RPC 기반 파생값.
 *   따라서 "HoF 가 된 순간" 을 이벤트로 받을 수 없고, 매 세션 폴링으로
 *   확인한다. first_entry 지급의 1회성은 서버 claims 테이블로 보장.
 */

interface ClaimResult {
  success: boolean;
  already_granted?: boolean;
  amount?: number;
  balance?: number;
  error?: string;
}

const RPCS: Array<{ name: string; label: string }> = [
  { name: "claim_hof_first_entry",    label: "명예의 전당 입성" },
  { name: "claim_hof_weekly_reward",  label: "주간 유지" },
  { name: "claim_hof_monthly_reward", label: "월간 유지" },
];

export function useHofRewardsAutoClaim() {
  const { user } = useAuth();
  const { data: isInHof = false, isLoading } = useIsInHallOfFame();
  const qc = useQueryClient();
  const firedRef = useRef<string | null>(null); // keyed per userId

  useEffect(() => {
    if (isLoading) return;
    if (!user?.id || !isInHof) return;
    if (firedRef.current === user.id) return;
    firedRef.current = user.id;

    let grantedTotal = 0;
    const grantedLabels: string[] = [];

    const run = async () => {
      for (const { name, label } of RPCS) {
        const { data, error } = await supabase.rpc(name as any);
        if (error) {
          console.warn(`[hof-rewards] ${name} failed`, error);
          continue;
        }
        const result = (data ?? {}) as ClaimResult;
        if (!result.success) continue;
        if (!result.already_granted && (result.amount ?? 0) > 0) {
          grantedTotal += result.amount!;
          grantedLabels.push(`${label} +${result.amount!.toLocaleString()}`);
        }
      }
      if (grantedTotal > 0) {
        qc.invalidateQueries({ queryKey: ["wallet"] });
        toast.success("명예의 전당 보상 🏆", {
          description: `${grantedLabels.join(" · ")} (+${grantedTotal.toLocaleString()} 파이트 머니)`,
        });
      }
    };

    void run();
  }, [user?.id, isInHof, isLoading, qc]);
}
