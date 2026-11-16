/**
 * 라이브보드 2번 화면 오른쪽 1/3 칸 — 플리스 사전예약 안내 ↔ 「오늘의 1분」 번갈아 (2026-11-17 대표님 「다음진행」)
 *   대표님 결정 ⑤ 「TV 는 라이브보드 2번 화면 오른쪽 칸에 번갈아 · 플리스 사전예약이 끝나면 그 자리를 이어받기」.
 *   · 사전예약이 열려 있고 「오늘의 1분」도 켠 지점이면 40초마다 번갈아(시계 기준 — 새로고침해도 이어진다 · 나타날 때 페이드 한 번).
 *   · 한쪽만 있으면 그쪽만 · 둘 다 없으면 칸이 없어져 런칭 이벤트가 화면 전체를 쓴다(예전 그대로).
 *   · 두 쪽 모두 그려 둔 채 보이는 쪽만 바꾼다(사진을 다시 받지 않게).
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
import { cn } from "@/lib/utils";
import { getGoodsCampaign } from "@/services/goodsService";

const SHOWN = "flex min-h-0 w-full animate-in fade-in duration-700";

const LiveBoardSideSlot = ({ branchName }: { branchName?: string }) => {
  // 날짜가 바뀌거나 번갈아 보여 줄 때가 되면 다시 그린다 (5초마다 시계만 본다)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(t);
  }, []);
  const today = kstToday(now);

  // 사전예약이 열려 있나 — LiveBoardGoodsCard 와 같은 캐시
  const { data: campaign } = useQuery({
    queryKey: ["goods-campaign", GOODS_FLEECE_SLUG, "tv"],
    queryFn: () => getGoodsCampaign(GOODS_FLEECE_SLUG),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  });
  const hasGoods = !!campaign && isAccepting(campaign);

  // 오늘 글 — 홈 카드와 같은 캐시(달마다 파일 · 번들)
  const growthOn = growthTvOn(branchName);
  const { data: lessons } = useQuery({
    queryKey: ["153growth", "lessons", monthsFor(today).join(",")],
    queryFn: () => loadGrowthLessons(today),
    enabled: growthOn,
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  });
  const model = growthOn && lessons ? tvGrowthOf(todayLesson(today, lessons), today) : null;

  const side = tvSideOf(now, hasGoods, !!model);
  if (!side) return null;
  return (
    <div className="flex min-h-0 w-1/3 shrink-0">
      {hasGoods && (
        <div className={cn(side === "goods" ? SHOWN : "hidden")}>
          <LiveBoardGoodsCard branchName={branchName} fill />
        </div>
      )}
      {model && (
        <div className={cn(side === "growth" ? SHOWN : "hidden")}>
          <LiveBoardGrowthCard model={model} />
        </div>
      )}
    </div>
  );
};

export default LiveBoardSideSlot;
