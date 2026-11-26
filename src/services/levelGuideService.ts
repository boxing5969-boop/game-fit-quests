/**
 * 레벨업 안내 — 계정 기록 (서버 member_guide_status · member_guide_mark · 2026-11-27)
 * 화면은 member_guides 표를 직접 쓰지 못한다. 기록만 하고 보상 · 지갑과는 상관없다.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseGuideStatus, type GuideStatus } from "@/lib/levelGuide";

export const GUIDE_STATUS_KEY = ["153guide", "status"] as const;

export type GuideEvent = "open" | "done" | "skip";

// 새 함수는 types.ts 재생성 전 — 다른 파일과 같은 캐스트
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args: Record<string, unknown>) => (supabase.rpc as any)(fn, args) as Promise<{ data: unknown; error: unknown }>;

export async function fetchGuideStatus(guide: string): Promise<GuideStatus> {
  const { data, error } = await rpc("member_guide_status", { p_guide: guide });
  if (error) throw error;
  return parseGuideStatus(data);
}

/** 열 때 · 닫을 때 한 번씩. 실패해도 화면은 그대로 (이 기기 기록이 예비) */
export async function markGuide(guide: string, event: GuideEvent, step: number): Promise<GuideStatus | null> {
  try {
    const { data, error } = await rpc("member_guide_mark", { p_guide: guide, p_event: event, p_step: Math.max(0, Math.round(step)) });
    if (error) return null;
    return parseGuideStatus(data);
  } catch {
    return null;
  }
}

/** 내 기록 — 계정이 바뀌면 새로 읽는다. 한 번 읽으면 이번 접속 동안 그대로 */
export function useGuideStatus(uid: string | null, guide: string, enabled: boolean) {
  return useQuery({
    queryKey: [...GUIDE_STATUS_KEY, uid, guide],
    enabled: enabled && !!uid,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: () => fetchGuideStatus(guide),
  });
}
