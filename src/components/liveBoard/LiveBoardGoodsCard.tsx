/**
 * 153 — 라이브보드 2번 화면 오른쪽 위 '153 플리스 집업 사전예약' 안내 (2026-11-12 대표님
 *   「라이브 보드2 큐알있는부분 빼자 왜냐면 반대쪽 사이니지에 QR이있어서 그거 빼고 3분의1정도는 플리스 안내하자」).
 *
 *   · 2번 화면은 QR 출석 카드를 빼고 이 카드를 오른쪽 패널 높이의 1/3 로 둔다. QR 은 옆 사이니지(번호 없는 기본 화면 · 1번)에 그대로.
 *   · 사전예약이 열려 있을 때만(goods_campaign_info — anon). 마감이 지나거나 서버에 닿지 않으면 그리지 않는다(활동 중 칸이 그 자리를 쓴다).
 *   · 사진은 흰색 · 진회색 인쇄 모델 컷을 6초마다 번갈아. 글은 멀리서도 읽히게 크게 — 가격 · 인쇄 색 · 마감 · 신청하는 곳.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GOODS_FLEECE_SLUG, ddayLabel, deadlineLabel, won } from "@/lib/goodsPreorder";
import { getGoodsCampaign } from "@/services/goodsService";

const PHOTOS = [
  { src: "/goods/fleece/img/model-back.webp", label: "흰색 인쇄" },
  { src: "/goods/fleece/img/model-back-gray.webp", label: "진회색 인쇄" },
];

const LiveBoardGoodsCard = ({ className = "" }: { className?: string }) => {
  const { data: c } = useQuery({
    queryKey: ["goods-campaign", GOODS_FLEECE_SLUG, "tv"],
    queryFn: () => getGoodsCampaign(GOODS_FLEECE_SLUG),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  });
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((v) => (v + 1) % PHOTOS.length), 6000);
    return () => window.clearInterval(t);
  }, []);

  if (!c?.ok || !c.open) return null;

  return (
    <div className={`flex flex-col border-b border-gray-800/60 bg-gradient-to-b from-gray-800/70 to-gray-900/40 px-5 py-4 ${className}`}>
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="relative h-full min-h-0 w-[38%] shrink-0 overflow-hidden rounded-xl bg-[#E9E7E3]">
          {PHOTOS.map((p, n) => (
            <img
              key={p.src}
              src={p.src}
              alt={`153 플리스 집업 ${p.label}`}
              draggable={false}
              className={`absolute inset-0 h-full w-full select-none object-cover object-top transition-opacity duration-1000 ${n === i ? "opacity-100" : "opacity-0"}`}
            />
          ))}
          <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-sm font-black text-white">{PHOTOS[i].label}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="w-fit rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-base font-black text-emerald-300">회원 사전예약</span>
          <p className="mt-2 text-3xl font-black leading-tight text-white">153 플리스 집업</p>
          <p className="mt-2 text-4xl font-black tabular-nums leading-none text-white">{won(c.price)}</p>
          <p className="mt-3 flex items-center gap-2 text-lg font-bold text-gray-300">
            <i className="inline-block h-4 w-4 rounded-full border border-white/30 bg-[#F2F2F0]" />흰색
            <i className="ml-1 inline-block h-4 w-4 rounded-full border border-white/30 bg-[#63666A]" />진회색 인쇄
          </p>
          <p className="mt-1.5 text-lg font-bold text-gray-300">
            {deadlineLabel(c.closes_at)}까지 · <span className="font-black text-emerald-300">{ddayLabel(c)}</span>
          </p>
        </div>
      </div>
      <p className="mt-3 shrink-0 rounded-lg bg-white/5 px-3 py-2 text-center text-lg font-black text-white">
        신청은 마이복서153 앱 홈 · 데스크에서
      </p>
    </div>
  );
};

export default LiveBoardGoodsCard;
