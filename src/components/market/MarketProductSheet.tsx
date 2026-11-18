/**
 * 🛍 153 마켓 — 상품 창 (옵션 · 수량 · 한마디 → 주문하기)
 *   주문은 결제 전(applied)으로 들어가고, 체육관 데스크에서 결제하면 운영진이 「결제 확인」을 누른다.
 *   검사는 서버(market_order_place)와 같은 말 — lib/market153 placeError.
 */
import { useEffect, useState } from "react";
import { Check, Clock, Minus, Plus, Store } from "lucide-react";
import { toast } from "sonner";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { PriceBlock, ProductThumb } from "@/components/market/MarketParts";
import {
  MARKET_SOURCE,
  NOTE_MAX,
  categoryMeta,
  compareOf,
  orderTitle,
  placeError,
  won,
  type MarketHome,
  type MarketOrder,
  type MarketProduct,
} from "@/lib/market153";
import { useMarketActions } from "@/services/marketService";
import { cn } from "@/lib/utils";

export interface MarketProductSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: MarketProduct | null;
  home: MarketHome;
  onSeeOrders: () => void;
}

const MarketProductSheet = ({ open, onOpenChange, product, home, onSeeOrders }: MarketProductSheetProps) => {
  const { place } = useMarketActions();
  const [option, setOption] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<MarketOrder | null>(null);

  useEffect(() => {
    if (!open) return;
    setOption(null);
    setQty(1);
    setNote("");
    setError(null);
    setDone(null);
  }, [open, product?.id]);

  if (!product) return null;
  const compare = compareOf(product, home.today, home.staleDays);
  const total = product.price * qty;
  const blocked = home.preview ? "미리 보기 중이에요" : product.soldOut ? "지금은 품절이에요" : null;

  const submit = async () => {
    const e = placeError(product, option, qty, note);
    if (e) {
      setError(e);
      return;
    }
    try {
      const r = await place.mutateAsync({ productId: product.id, option: product.options.length ? option : null, qty, note });
      if (r.order) setDone(r.order);
      else {
        toast.success("주문했어요 · 데스크에서 결제해 주세요");
        onOpenChange(false);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">{done ? "주문했어요" : (product.brand ?? categoryMeta(product.category).label)}</DrawerTitle>
          <DrawerDescription className="text-label">
            {done ? "체육관 데스크에서 결제하면 주문이 들어가요" : "주문 → 데스크 결제 → 체육관에서 받기"}
          </DrawerDescription>
        </DrawerHeader>

        {done ? (
          <div className="space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-6 w-6" strokeWidth={3} />
              </span>
              <p className="mt-3 text-body font-bold text-foreground">{orderTitle(done)}</p>
              <p className="mt-1 text-title font-black tabular-nums tracking-tight text-foreground">{won(done.amount)}</p>
              <p className="mt-2 text-label text-muted-foreground">
                주문 번호 <b className="font-bold tabular-nums text-foreground">{done.orderNo}</b>
              </p>
            </div>
            <p className="text-label leading-relaxed text-muted-foreground">
              데스크에서 주문 번호나 이름을 말씀해 주세요. 결제가 확인되면 주문을 넣고, 도착하면 알림으로 알려 드려요.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-secondary text-body font-bold text-secondary-foreground active:scale-[0.98]"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onSeeOrders();
                }}
                className="flex h-14 flex-[1.4] items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98]"
              >
                내 주문 보기
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
              <div className="flex gap-3.5">
                <span className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-border">
                  <ProductThumb product={product} />
                </span>
                <span className="min-w-0 flex-1 self-center">
                  <span className="block text-heading font-bold leading-snug text-foreground">{product.name}</span>
                  {product.model && <span className="mt-0.5 block text-label tabular-nums text-muted-foreground">{product.model}</span>}
                  {product.summary && <span className="mt-1 block text-label leading-snug text-muted-foreground">{product.summary}</span>}
                </span>
              </div>

              <div className="space-y-2">
                <PriceBlock price={product.price} compare={compare} />
                <p className="flex items-center gap-1.5 px-1 text-label text-muted-foreground">
                  <Store className="h-4 w-4 shrink-0" aria-hidden />
                  {MARKET_SOURCE.line}
                </p>
              </div>

              {product.options.length > 0 && (
                <section aria-label={product.optionLabel ?? "옵션"}>
                  <p className="text-label font-bold text-muted-foreground">{product.optionLabel ?? "옵션"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.options.map((o) => (
                      <button
                        key={o}
                        type="button"
                        aria-pressed={option === o}
                        onClick={() => {
                          setOption(o);
                          setError(null);
                        }}
                        className={cn(
                          "h-11 min-w-[3.25rem] rounded-xl border px-3.5 text-body font-bold tabular-nums transition-colors",
                          option === o ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground",
                        )}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section aria-label="수량" className="flex items-center justify-between gap-3">
                <p className="text-label font-bold text-muted-foreground">
                  수량 <span className="font-medium">· {product.maxQty}개까지</span>
                </p>
                <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-1">
                  <button
                    type="button"
                    aria-label="하나 줄이기"
                    disabled={qty <= 1}
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground active:bg-muted disabled:opacity-30"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-9 text-center text-body font-black tabular-nums text-foreground" aria-live="polite">
                    {qty}
                  </span>
                  <button
                    type="button"
                    aria-label="하나 늘리기"
                    disabled={qty >= product.maxQty}
                    onClick={() => setQty((q) => Math.min(product.maxQty, q + 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-foreground active:bg-muted disabled:opacity-30"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </section>

              <div>
                <label htmlFor="market-note" className="text-label font-bold text-muted-foreground">
                  전할 말 <span className="font-medium">· 선택</span>
                </label>
                <input
                  id="market-note"
                  value={note}
                  maxLength={NOTE_MAX + 20}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setError(null);
                  }}
                  placeholder="예: 금요일 저녁에 받을게요"
                  className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-4 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {product.leadNote && (
                <p className="flex items-center gap-1.5 text-label text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden />
                  {product.leadNote} · 체육관에서 받아요
                </p>
              )}

            </div>

            {/* 주문 단추는 늘 보이게 — 옵션이 많아 내용이 길어져도 창 아래에 붙어 있다 */}
            <div className="space-y-2 border-t border-border px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
              {error && (
                <p role="alert" className="text-label font-bold text-destructive">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={!!blocked || place.isPending}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
              >
                {blocked ?? (place.isPending ? "주문하는 중" : `주문하기 · ${won(total)}`)}
              </button>
              {!blocked && <p className="text-center text-label text-muted-foreground">결제는 체육관 데스크에서 해요 (카드 · 계좌이체)</p>}
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};

export default MarketProductSheet;
