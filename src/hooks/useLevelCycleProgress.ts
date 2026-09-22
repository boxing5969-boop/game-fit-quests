/**
 * 승급 진행도 — 홈 라이센스 카드의 막대가 쓰는 단일 출처 (2026-09-22).
 *
 * 대표님 결정: 막대는 "누적 XP / 300" 이 아니라 "승급 진행도 / 필요 횟수" 다.
 * 가득 차면 화이트·블루는 자동 승급, 레드·블랙은 승급 심사 신청.
 * 숫자는 전부 서버(get_level_cycle_progress)가 계산한다 — auto_advance_from_attendance 와
 * 같은 식(출석 1회 = 1.0, 운동시간 120분이면 1.25)이라 화면과 판정이 어긋나지 않는다.
 *
 * 쿼리키 ["level-cycle", userId] 는 RoutinesPage 와 같은 RPC·같은 키 — 캐시를 공유한다.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const LEVEL_CYCLE_KEY = ["level-cycle"] as const;

export interface LevelCycleProgress {
  sessions: number;
  days: number;
  minutes: number;
  reqSessions: number;
  reqDays: number;
  reqMinutes: number;
  reqMinDays: number;
  elapsedDays: number;
  rank: string;
  currentLevel: number;
  /** 승급 진행도 (예: 2.25). floor 가 실제 판정값 */
  progress: number;
  progressFloor: number;
  /** true = 가득 차면 자동 승급 (화이트·블루), false = 승급 심사 신청 (레드·블랙) */
  autoAdvances: boolean;
  fastTrackGates: number;
  meets: boolean;
  since: string;
}

export function useLevelCycleProgress(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...LEVEL_CYCLE_KEY, user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_level_cycle_progress", {});
      if (error) throw error;
      return data as LevelCycleProgress;
    },
  });
}

/** 출석·운동 종료 뒤 진행도를 다시 묻게 한다. */
export function useInvalidateLevelCycle() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: LEVEL_CYCLE_KEY });
}

/** 카드 막대 아래 한 줄 — 가득 차면 무슨 일이 생기는지. */
export function promotionHint(p: Pick<LevelCycleProgress, "currentLevel" | "autoAdvances"> | undefined): string {
  if (!p) return "";
  if (p.currentLevel >= 10) return "타이틀매치 · 코치 승인으로 다음 리그";
  return p.autoAdvances ? "가득 차면 자동 승급 · 오래 운동할수록 빨리 차요" : "가득 차면 승급 심사 신청";
}
