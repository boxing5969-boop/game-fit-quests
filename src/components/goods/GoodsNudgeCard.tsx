/**
 * 홈 '153 플리스 집업 사전예약' 안내 카드 (2026-11-12 대표님 「마이복서에 올려서 회원님들에게 판매신청받고」).
 * 보이는 때: 사전예약이 열려 있는 동안만(마감이 지나면 저절로 사라진다 — 홈 카드를 늘리지 않는 원칙).
 *   · 아직 신청 전 → 상품 사진 + 가격 · 마감 → 누르면 상세페이지(정적 HTML /goods/fleece)
 *   · 신청했고 결제 전 → '결제 전 · ○일까지 ○○점 데스크에서 결제'
 *   · 결제를 마쳤으면 → 안 보인다
 * 서버 함수가 없거나(적용 전 · 미리보기 주소) 실패하면 조용히 숨긴다.
 * 선착순(2026-11-12 23시 대표님 「2만5천원 … 50장 선착순」): 다 차면 아직 신청 전인 회원에게는 안 보인다(결제 전 안내는 그대로).
 */
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  GOODS_FLEECE_PATH,
  GOODS_FLEECE_SLUG,
  ddayLabel,
  deadlineLabel,
  isSoldOut,
  shortBranch,
  won,
  type GoodsCampaign,
} from "@/lib/goodsPreorder";
import { getGoodsCampaign, getGoodsMyPage } from "@/services/goodsService";
import { leaveApp } from "@/lib/docCache";

/** 한 줄에 들어가게 짧게 — '50벌 한정' · '남은 12벌' · (제한 없으면) '11월 26일(목)까지' */
const stockShort = (c: GoodsCampaign): string => {
  if (c.stock_limit == null) return `${deadlineLabel(c.closes_at)}까지`;
  const left = c.stock_left == null ? c.stock_limit : Math.max(0, c.stock_left);
  return left >= c.stock_limit ? `${c.stock_limit}벌 한정` : `남은 ${left}벌`;
};

const GoodsNudgeCard = () => {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["goods-nudge", GOODS_FLEECE_SLUG, user?.id ?? null],
    queryFn: async () => {
      const [campaign, mine] = await Promise.all([getGoodsCampaign(GOODS_FLEECE_SLUG), getGoodsMyPage(GOODS_FLEECE_SLUG)]);
      return { campaign, mine };
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const c = data?.campaign;
  if (!c?.ok || !c.open) return null;
  const orders = data?.mine?.orders ?? [];
  const waiting = orders.filter((o) => o.status === "applied");
  const done = orders.some((o) => o.status === "paid" || o.status === "delivered");
  if (done && waiting.length === 0) return null;
  if (waiting.length === 0 && isSoldOut(c)) return null;

  // 같은 탭에서 정적 상세페이지로 — 지금 화면의 HTML 사본을 먼저 새로 받아 둬야 거기서 뒤로가기를 눌렀을 때
  // 흰 화면이 안 된다(src/lib/docCache.ts · 2026-11-13). 끝 '/' 까지 붙여 308 한 번을 건너뛴다.
  const open = () => void leaveApp(`${GOODS_FLEECE_PATH}/?from=app`);

  if (waiting.length > 0) {
    const branch = shortBranch(waiting[0].branch_name);
    return (
      <button
        type="button"
        onClick={open}
        className="flex w-full items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/[0.07] px-4 py-3.5 text-left transition-transform active:scale-[0.99]"
      >
        <img src="/goods/fleece/img/model-back.webp?v=2" alt="" className="h-14 w-11 shrink-0 rounded-xl object-cover" loading="lazy" />
        <span className="min-w-0 flex-1">
          <span className="block text-label font-extrabold text-foreground">플리스 집업 신청 완료 · 결제 전</span>
          <span className="mt-0.5 block text-label text-muted-foreground">
            {deadlineLabel(c.closes_at)}까지 {branch} 데스크에서 결제해 주세요
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-elev-1 transition-transform active:scale-[0.99]"
    >
      <img src="/goods/fleece/img/model-back.webp?v=2" alt="" className="h-14 w-11 shrink-0 rounded-xl object-cover" loading="lazy" />
      <span className="min-w-0 flex-1">
        <span className="block text-label font-extrabold text-foreground">153 플리스 집업 · 원가 판매</span>
        <span className="mt-0.5 block text-label text-muted-foreground">
          {won(c.price)} · {stockShort(c)} · {ddayLabel(c)}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
};

export default GoodsNudgeCard;
