/**
 * 🥇 이름 옆 대회 메달 (2026-10-15 대표님: "생활체육대회 수상한 회원은 이름 옆에 금·은·동 메달")
 *   DB: member_medals → get_member_medals() (TV 처럼 로그인 없어도 읽힌다). 한 사람이 여러 개면 가장 좋은 메달 하나.
 *   라이센스 카드 · TV 라이브보드(운동 중 카드 · 오늘 다녀간 회원 · 코치진 · 랭킹 띠) · 앱 랭킹 이름 옆에 붙는다.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type MedalKind = "gold" | "silver" | "bronze";

export interface MemberMedal {
  medal: MedalKind;
  title: string;
}

const MEDAL_EMOJI: Record<MedalKind, string> = { gold: "🥇", silver: "🥈", bronze: "🥉" };
const MEDAL_LABEL: Record<MedalKind, string> = { gold: "우승", silver: "준우승", bronze: "3위" };

export const MEMBER_MEDALS_KEY = ["member-medals"] as const;

/** user_id → 가장 좋은 메달 (10분 캐시 · 실패해도 화면은 그대로) */
export const useMemberMedals = () =>
  useQuery({
    queryKey: MEMBER_MEDALS_KEY,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
    queryFn: async (): Promise<Map<string, MemberMedal>> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_member_medals");
      if (error) throw error;
      const map = new Map<string, MemberMedal>();
      for (const r of (data ?? []) as { user_id: string; medal: MedalKind; event_title: string }[]) {
        if (!map.has(r.user_id)) map.set(r.user_id, { medal: r.medal, title: r.event_title });
      }
      return map;
    },
  });

interface Props {
  userId?: string | null;
  className?: string;
}

/** 메달이 있는 회원이면 이름 옆에 🥇🥈🥉, 없으면 아무것도 안 그린다 */
const MedalMark = ({ userId, className }: Props) => {
  const { data } = useMemberMedals();
  const m = userId ? data?.get(userId) : undefined;
  if (!m) return null;
  const label = `${m.title} ${MEDAL_LABEL[m.medal]}`;
  return (
    <span role="img" aria-label={label} title={label} className={cn("shrink-0 leading-none", className)}>
      {MEDAL_EMOJI[m.medal]}
    </span>
  );
};

export default MedalMark;
