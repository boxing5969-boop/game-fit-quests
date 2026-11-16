// 지점장 · 코치 홈의 「153 마켓 주문함」 카드 (2026-11-17) — 누르면 MarketOrdersPanel 탭.
// 우리 지점 마켓이 켜져 있을 때만 보인다(서버 market_admin_board — 함수가 없거나 꺼진 지점이면 숨김).
import { ChevronRight } from "lucide-react";
import { icon3dSrc } from "@/lib/emoji3d/map";
import { boardTodoCount } from "@/lib/market153";
import { useMarketBoard } from "@/services/marketService";

const MarketAdminEntryCard = ({ onOpen }: { onOpen: () => void }) => {
  const { data: board } = useMarketBoard(null);
  if (!board?.available || !board.on) return null;
  const todo = boardTodoCount(board.orders);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left active:scale-[0.99]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary">
        <img src={icon3dSrc("glove_mint")} alt="" className="h-8 w-8 object-contain" loading="lazy" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-black text-foreground">153 마켓 주문함</span>
        <span className="block text-label text-muted-foreground">
          {todo > 0 ? `할 일 ${todo}건 · 결제 확인 · 발주 · 전달` : "새 주문이 오면 여기에 떠요"}
        </span>
      </span>
      {todo > 0 && (
        <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-micro font-black tabular-nums text-destructive-foreground">
          {todo}
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
};

export default MarketAdminEntryCard;
