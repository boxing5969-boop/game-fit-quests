/**
 * 라이브보드 2번 화면 오른쪽 1/3 칸 — 플리스 사전예약 안내 → (사전예약이 끝나면) 「오늘의 1분」
 *   2026-11-17 아침: 대표님 결정 ⑤ 「TV 는 라이브보드 2번 화면 오른쪽 칸에 번갈아 · 플리스 사전예약이 끝나면 그 자리를 이어받기」로 40초마다 번갈아.
 *   같은 날 13시 대표님 「폴리스집업 그대로 나오게 해줘」 → 사전예약이 열린 동안은 플리스 안내만(예전 그대로) ·
 *   닫히면(마감 · 선착순이 다 차면) 「오늘의 1분」이 그 칸을 이어받는다 · 둘 다 없으면 칸이 없어져 왼쪽 보드가 화면 전체를 쓴다.
 *   · 사전예약 정보를 읽는 동안은 칸을 그리지 않는다(「오늘의 1분」이 잠깐 비쳤다가 플리스로 바뀌지 않게).
 *   「오늘의 1분」 = 켠 지점 TV 만(lib/growthStage2 GROWTH_TV_BRANCHES) · 글은 홈 카드와 같은 달 파일(번들) — 서버를 부르지 않는다.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import LiveBoardGoodsCard from "@/components/liveBoard/LiveBoardGoodsCard";
import LiveBoardGrowthCard from "@/components/liveBoard/LiveBoardGrowthCard";
import { loadGrowthLessons, monthsFor, todayLesson } from "@/data/growthLessons";
import { kstToday } from "@/lib/attendanceCheer";
import { GOODS_FLEECE_SLUG, isAccepting } from "@/lib/goodsPreorder";
import { growthTvOn, tvGrowthOf, tvSideOf } from "@/lib/growthStage2";
import { getGoodsCampaign } from "@/services/goodsService";

const SHOWN = "flex min-h-0 w-full animate-in fade-in duration-700";

const LiveBoardSideSlot = ({ branchName }: { branchName?: string }) => {
  // 날짜가 바뀌면 오늘 글로 (1분마다 시계만 본다)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const today = kstToday(now);

  // 사전예약이 열려 있나 — LiveBoardGoodsCard 와 같은 캐시
  const { data: campaign, isPending } = useQuery({
    queryKey: ["goods-campaign", GOODS_FLEECE_SLUG, "tv"],
    queryFn: () => getGoodsCampaign(GOODS_FLEECE_SLUG),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  });
  const hasGoods = !!campaign && isAccepting(campaign);

  // 오늘 글 — 홈 카드와 같은 캐시(달마다 파일 · 번들) · 사전예약이 열린 동안은 받지 않는다
  const growthOn = growthTvOn(branchName) && !isPending && !hasGoods;
  const { data: lessons } = useQuery({
    queryKey: ["153growth", "lessons", monthsFor(today).join(",")],
    queryFn: () => loadGrowthLessons(today),
    enabled: growthOn,
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  });
  const model = growthOn && lessons ? tvGrowthOf(todayLesson(today, lessons), today) : null;

  if (isPending) return null;
  const side = tvSideOf(hasGoods, !!model);
  if (!side) return null;
  return (
    <div className="flex min-h-0 w-1/3 shrink-0">
      <div key={side} className={SHOWN}>
        {side === "goods" ? (
          <LiveBoardGoodsCard branchName={branchName} fill />
        ) : (
          model && <LiveBoardGrowthCard model={model} />
        )}
      </div>
    </div>
  );
};

export default LiveBoardSideSlot;
