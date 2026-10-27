/**
 * 153 커뮤니티 — /myboxer/community (ProtectedRoute — 로그인 회원 전체).
 *
 * 2026-10-15 대표님 개편: "지금은 너무 복잡하고 새로운 용어로 어렵다 — 우리만의 문화를 만들자. 반응 이름은 153".
 *   · 카드 9개 → 맨 위 바로가기 줄(응원 · 짝꿍 · 같이 해요 · 장비 · 지점 목표) + 모두의 피드 하나
 *   · 글쓰기는 버튼 하나: '오늘 운동 한 줄' (사진 한 장 · 전체 공개/친구만/나만 보기 — 2026-10-18)
 *   · 반응은 153 하나 (TV '이번 주 153왕' 띠는 2026-10-19 에 뺐다)
 *   · 같은 시간대 카드는 내정보로 옮김 · 타이틀매치 축하는 피드의 '승급 축하' 카드가 대신한다
 *   · "공식 레벨업과 무관" 안내는 맨 아래 한 줄만
 * 기능은 하나도 없애지 않았다 — 각 시트는 그대로 열린다.
 *
 * 2026-10-27 커뮤니티 1단계 (대표님 "니가 추천해주는대로 진행" — 「마이복서153 커뮤니티 탭 업그레이드 보고서」):
 *   · 머리 오른쪽 '받은 153' → 받은 153 시트(누가 보냈나 + 153 돌려주기) · 153 알림 링크 ?received=1
 *   · 댓글 알림 링크 ?entry=<글> → 그 글의 댓글 창
 *   · 153 을 길게 누르면 한마디 응원(피드 안) · 글씨 · 단추 키우기
 *   · 들어올 때마다 '마지막으로 본 때'를 남긴다 — 홈 '오늘 우리 체육관' 띠의 새 소식 기준
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake, Megaphone, PenLine, Shirt, Target, Users } from "lucide-react";

import CommunityFeed from "@/components/engagement/CommunityFeed";
import ChampionJournalSheet from "@/components/engagement/ChampionJournalSheet";
import SecondCheerSheet, { type CheerInitialTarget } from "@/components/engagement/SecondCheerSheet";
import Received153Sheet, { RECEIVED_153_KEY } from "@/components/engagement/Received153Sheet";
import CornermanSheet from "@/components/engagement/CornermanSheet";
import PartnerCallSheet from "@/components/engagement/PartnerCallSheet";
import GearShareSheet from "@/components/engagement/GearShareSheet";
import GymRaidSheet from "@/components/engagement/GymRaidSheet";
import { useMyCornermanStatus } from "@/hooks/useCornerman";
import { usePartnerCalls } from "@/hooks/useCommunityHub";
import { useAuth } from "@/contexts/AuthContext";
import { getMyReceived153, markCommunityVisited } from "@/services/communityFeedService";

type SheetKey = "journal" | "cheer" | "buddy" | "together" | "gear" | "goal" | null;

const MyBoxerCommunityPage = () => {
  const [sheet, setSheet] = useState<SheetKey>(null);
  const close = () => setSheet(null);
  const { data: buddy } = useMyCornermanStatus();
  const { data: calls } = usePartnerCalls();
  const buddyRequests = buddy?.pending_received.length ?? 0;
  const togetherCount = (calls?.calls ?? []).filter((c) => !c.isMine).length;

  // 받은 153 (시트와 같은 캐시) · 응원 보내기(돌려줄 카드가 없는 동료)
  const { user } = useAuth();
  const qc = useQueryClient();
  const [receivedOpen, setReceivedOpen] = useState(false);
  const [cheerTarget, setCheerTarget] = useState<CheerInitialTarget | null>(null);
  const received = useQuery({ queryKey: RECEIVED_153_KEY, queryFn: () => getMyReceived153(7), staleTime: 60_000, retry: false });
  const receivedTotal = received.data?.total ?? 0;

  // 알림 링크 — ?received=1 받은 153 · ?entry=<글> 그 글의 댓글 창
  const [params, setParams] = useSearchParams();
  const entryParam = params.get("entry");
  useEffect(() => {
    if (params.get("received") === "1") {
      setReceivedOpen(true);
      const next = new URLSearchParams(params);
      next.delete("received");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);
  const clearEntryParam = () => {
    const next = new URLSearchParams(params);
    next.delete("entry");
    setParams(next, { replace: true });
  };

  // 들어올 때마다 '마지막으로 본 때' — 홈 띠의 새 소식은 이 뒤에 올라온 것
  useEffect(() => {
    markCommunityVisited(user?.id);
    return () => {
      markCommunityVisited(user?.id);
      qc.invalidateQueries({ queryKey: ["community-home-strip"] });
    };
  }, [user?.id, qc]);

  const shortcuts: { key: Exclude<SheetKey, null | "journal">; label: string; Icon: typeof Users; badge?: number }[] = [
    { key: "cheer", label: "응원 보내기", Icon: Megaphone },
    { key: "buddy", label: "운동 짝꿍", Icon: Handshake, badge: buddyRequests },
    { key: "together", label: "오늘 같이 해요", Icon: Users, badge: togetherCount },
    { key: "gear", label: "장비 나눔", Icon: Shirt },
    { key: "goal", label: "우리 지점 목표", Icon: Target },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-dvh bg-background pb-32"
    >
      <div className="mx-auto w-full max-w-md md:max-w-xl space-y-4 px-4 py-5">
        {/* 헤더 */}
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-300/80">MYBOXER 153</p>
            <h1 className="text-2xl font-black leading-tight text-foreground">153 커뮤니티</h1>
            <p className="text-[13px] leading-snug text-muted-foreground">
              오늘 같이 운동한 사람들 · 153은 누르기, 길게 누르면 한마디 응원
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReceivedOpen(true)}
            className="mt-5 inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-pill border border-primary/50 bg-primary/10 px-3.5 text-[13.5px] font-black text-primary active:scale-95"
          >
            받은 153
            {receivedTotal > 0 && <span className="number-font">{receivedTotal}</span>}
          </button>
        </header>

        {/* 바로가기 */}
        <nav aria-label="바로가기" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {shortcuts.map(({ key, label, Icon, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSheet(key)}
              className="relative flex min-w-[4.6rem] flex-1 flex-col items-center gap-1 rounded-2xl border border-border bg-card px-1.5 py-2.5 active:scale-95"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="whitespace-nowrap text-[12px] font-bold text-foreground">{label}</span>
              {!!badge && badge > 0 && (
                <span className="number-font absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[10px] font-black leading-[18px] text-white">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* 글쓰기 — 버튼 하나 (data-tour: 7일 캠프 / 튜토리얼이 이 버튼을 강조한다) */}
        <button
          type="button"
          onClick={() => setSheet("journal")}
          data-tour="champion-journal-card"
          className="flex w-full items-center gap-3 rounded-card border border-primary/30 bg-primary/5 px-3.5 py-3 text-left active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <PenLine className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-foreground">오늘 운동 한 줄 남기기</span>
            <span className="block truncate text-[12.5px] text-muted-foreground">
              사진 한 장 + 한 줄이면 끝 · 오늘 첫 글 챔피언 머니 +50
            </span>
          </span>
        </button>

        {/* 모두의 피드 */}
        <CommunityFeed openEntryId={entryParam} onEntryHandled={clearEntryParam} />

        {/* 153 커뮤니티 약속 3가지 */}
        <section className="rounded-card border border-border bg-muted/30 px-3.5 py-3">
          <p className="text-[12.5px] font-black tracking-wider text-foreground">153 커뮤니티 약속</p>
          <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-[13px] leading-relaxed text-muted-foreground">
            <li>비교하지 않고 응원한다.</li>
            <li>몸 이야기는 내 것만 한다.</li>
            <li>어제의 나보다 한 판 더.</li>
          </ol>
          <p className="mt-2 text-[12px] text-muted-foreground">커뮤니티 활동은 공식 레벨업과 무관해요.</p>
        </section>
      </div>

      <ChampionJournalSheet open={sheet === "journal"} onClose={close} />
      <SecondCheerSheet open={sheet === "cheer"} onClose={close} />
      <CornermanSheet open={sheet === "buddy"} onClose={close} />
      <PartnerCallSheet open={sheet === "together"} onClose={close} />
      <GearShareSheet open={sheet === "gear"} onClose={close} />
      <GymRaidSheet open={sheet === "goal"} onClose={close} />
      <Received153Sheet open={receivedOpen} onClose={() => setReceivedOpen(false)} onCheer={(t) => setCheerTarget(t)} />
      <SecondCheerSheet open={!!cheerTarget} onClose={() => setCheerTarget(null)} initialTarget={cheerTarget} stacked />
    </motion.div>
  );
};

export default MyBoxerCommunityPage;
