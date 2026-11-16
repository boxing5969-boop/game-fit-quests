/**
 * 🛍 153 마켓 — 내 주문 창
 *   진행 중인 주문(받아 갈 것 → 결제할 것 → 기다리는 것) 먼저, 그 아래 지난 주문.
 *   결제 전 주문만 회원이 직접 취소한다(두 번 눌러서) — 결제한 주문은 데스크에서.
 */
import { useEffect, useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { OrderStatusChip, OrderSteps } from "@/components/market/MarketParts";
import { isOpenOrder, mdOfTime, orderMemberLine, orderTitle, won, type MarketHome, type MarketOrder } from "@/lib/market153";
import { useMarketActions } from "@/services/marketService";
import { cn } from "@/lib/utils";

const OPEN_RANK: Record<string, number> = { arrived: 0, applied: 1, paid: 2, ordered: 3 };
const PAST_SHOWN = 5;

const OrderCard = ({ order, onCancel, canceling }: { order: MarketOrder; onCancel?: (o: MarketOrder) => void; canceling: boolean }) => {
  const [armed, setArmed] = useState(false);
  const open = isOpenOrder(order);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);

  return (
    <li className={cn("rounded-2xl border border-border bg-card p-4", open && "shadow-elev-1")}>
      <div className="flex items-start gap-2">
        <p className={cn("min-w-0 flex-1 text-body font-bold leading-snug", open ? "text-foreground" : "text-muted-foreground")}>
          {orderTitle(order)}
        </p>
        <OrderStatusChip status={order.status} />
      </div>
      <p className="mt-1 text-label tabular-nums text-muted-foreground">
        {won(order.amount)} · {mdOfTime(order.createdAt)} 주문{order.orderNo ? ` · ${order.orderNo}` : ""}
      </p>

      {open && (
        <div className="mt-3">
          <OrderSteps status={order.status} />
        </div>
      )}

      <p className={cn("mt-3 text-label font-bold", order.status === "arrived" ? "text-primary" : open ? "text-foreground" : "text-muted-foreground")}>
        {orderMemberLine(order)}
      </p>

      {order.status === "applied" && onCancel && (
        <button
          type="button"
          disabled={canceling}
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            onCancel(order);
          }}
          className={cn(
            "mt-3 flex h-11 w-full items-center justify-center rounded-xl border text-label font-bold transition-colors disabled:opacity-50",
            armed ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-card text-muted-foreground",
          )}
        >
          {canceling ? "취소하는 중" : armed ? "한 번 더 누르면 취소돼요" : "주문 취소"}
        </button>
      )}
    </li>
  );
};

export interface MarketOrdersSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  home: MarketHome;
}

const MarketOrdersSheet = ({ open, onOpenChange, home }: MarketOrdersSheetProps) => {
  const { cancel } = useMarketActions();
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (open) setShowAll(false);
  }, [open]);

  const { live, past } = useMemo(() => {
    const live = home.orders
      .filter(isOpenOrder)
      .sort((a, b) => (OPEN_RANK[a.status] ?? 9) - (OPEN_RANK[b.status] ?? 9) || b.createdAt.localeCompare(a.createdAt));
    const past = home.orders.filter((o) => !isOpenOrder(o)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { live, past };
  }, [home.orders]);

  const onCancel = async (o: MarketOrder) => {
    try {
      await cancel.mutateAsync(o.id);
      toast.success("주문을 취소했어요");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const shownPast = showAll ? past : past.slice(0, PAST_SHOWN);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">내 주문</DrawerTitle>
          <DrawerDescription className="text-label">결제 · 받기는 체육관 데스크에서 해요</DrawerDescription>
        </DrawerHeader>

        <div className="space-y-5 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {live.length === 0 && past.length === 0 && (
            <div className="px-5 py-12 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                <ShoppingBag className="h-7 w-7 text-muted-foreground" />
              </span>
              <p className="mt-4 text-body font-bold text-foreground">아직 주문이 없어요</p>
              <p className="mt-1 text-label text-muted-foreground">마음에 드는 용품을 골라 주문해 보세요</p>
            </div>
          )}

          {live.length > 0 && (
            <ul className="space-y-2.5" aria-label="진행 중인 주문">
              {live.map((o) => (
                <OrderCard key={o.id} order={o} onCancel={onCancel} canceling={cancel.isPending && cancel.variables === o.id} />
              ))}
            </ul>
          )}

          {past.length > 0 && (
            <section aria-label="지난 주문">
              <p className="mb-2 text-label font-bold text-muted-foreground">지난 주문</p>
              <ul className="space-y-2.5">
                {shownPast.map((o) => (
                  <OrderCard key={o.id} order={o} canceling={false} />
                ))}
              </ul>
              {past.length > PAST_SHOWN && !showAll && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="mt-2.5 flex h-11 w-full items-center justify-center rounded-xl bg-secondary text-label font-bold text-secondary-foreground"
                >
                  지난 주문 {past.length - PAST_SHOWN}건 더 보기
                </button>
              )}
            </section>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MarketOrdersSheet;
