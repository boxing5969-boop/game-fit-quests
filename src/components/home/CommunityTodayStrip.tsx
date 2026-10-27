/**
 * 홈 '오늘 우리 체육관' 띠 (2026-10-27 대표님 "니가 추천해주는대로 진행" — 「마이복서153 커뮤니티 탭 업그레이드 보고서」 1단계).
 *   하단 탭 4개는 그대로 두고, 내 카드 바로 아래 한 줄로 커뮤니티 입구를 만든다.
 *   지금 운동 중(랭킹 탭 · TV 와 같은 기준) · 오늘 온 동료(피드 '오늘도 한 판'과 같은 기준)
 *   · 새 소식(커뮤니티를 마지막으로 연 뒤 올라온 한 줄 · 승급 · 목표 · 새 식구) · 오늘 받은 153
 *   누르면 /myboxer/community. 서버: get_community_home_strip (20261027231653_community_phase1.sql)
 *   아직 앱에서 숨겨 둔 지점 · 지점이 없는 계정 · 승인 전 계정에는 보이지 않는다.
 */
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Users } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { getCommunityHomeStrip, readCommunityLastVisit } from "@/services/communityFeedService";

const CommunityTodayStrip = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const since = readCommunityLastVisit(uid);

  const { data } = useQuery({
    queryKey: ["community-home-strip", uid, since],
    queryFn: () => getCommunityHomeStrip(since),
    enabled: !!uid,
    staleTime: 60_000,
  });

  if (!data?.success || data.visible === false || (!data.branch && !data.all_branches)) return null;

  const working = data.working_now ?? 0;
  const today = data.today ?? 0;
  const fresh = data.new_count ?? 0;
  const received = data.received_today ?? 0;

  const parts: string[] = [];
  if (working > 0) parts.push(`지금 ${working}명 운동 중`);
  if (today > 0) parts.push(`오늘 ${today}명 왔어요`);
  if (fresh > 0) parts.push(`새 소식 ${fresh}`);
  const line = parts.length > 0 ? parts.join(" · ") : "오늘 첫 소식을 기다리고 있어요";

  return (
    <button
      type="button"
      onClick={() => navigate("/myboxer/community")}
      aria-label={`오늘 우리 체육관 — ${line}${received > 0 ? ` · 오늘 받은 153 ${received}개` : ""}`}
      className="flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-card px-4 py-3.5 text-left shadow-elev-1 transition-transform active:scale-[0.99]"
    >
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Users className="h-5 w-5" />
        {working > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2.5 w-2.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-extrabold text-foreground">오늘 우리 체육관</span>
        <span className="mt-0.5 block text-label leading-snug text-muted-foreground">{line}</span>
      </span>
      {received > 0 && (
        <span className="number-font shrink-0 rounded-pill border border-primary/50 bg-primary/10 px-2.5 py-1 text-label font-black text-primary">
          받은 153 {received}
        </span>
      )}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
};

export default CommunityTodayStrip;
