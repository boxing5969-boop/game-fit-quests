// 지점장 · 코치 홈의 '굿즈 신청' 카드 (2026-11-12) — 누르면 GoodsOrdersPanel 탭.
// 사전예약이 열려 있거나 마감 뒤 45일 안(데스크 결제 · 받기 처리 기간)에만 보인다. 서버 함수가 없으면 숨긴다.
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { GOODS_FLEECE_SLUG, ddayLabel, deadlineLabel } from "@/lib/goodsPreorder";
import { getGoodsCampaign } from "@/services/goodsService";

const SHOW_AFTER_CLOSE_MS = 45 * 24 * 3600 * 1000;

const GoodsAdminEntryCard = ({ onOpen }: { onOpen: () => void }) => {
  const { data: c } = useQuery({
    queryKey: ["goods-campaign", GOODS_FLEECE_SLUG],
    queryFn: () => getGoodsCampaign(GOODS_FLEECE_SLUG),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  if (!c?.ok) return null;
  if (!c.open && Date.now() - new Date(c.closes_at).getTime() > SHOW_AFTER_CLOSE_MS) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left active:scale-[0.99]"
    >
      <img src="/goods/fleece/img/model-back.webp" alt="" className="h-12 w-9 shrink-0 rounded-lg object-cover" loading="lazy" />
      <span className="min-w-0 flex-1">
        <span className="block text-body font-black text-foreground">굿즈 신청 · {c.title}</span>
        <span className="block text-label text-muted-foreground">
          {c.open ? `${deadlineLabel(c.closes_at)} 마감 · ${ddayLabel(c)}` : "마감 · 데스크 결제 · 받음 처리"} · 결제 완료 · 받음 · 업체 발주표
        </span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
};

export default GoodsAdminEntryCard;
