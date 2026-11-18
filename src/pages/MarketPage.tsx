/**
 * 🛍 153 마켓 1단계 — /market (2026-11-17 대표님 「앱에 마켓 기능도 넣어서 인터넷 최저가 보다 저렴하게 회원님들에게 복싱용품등을 판매하자」 ·
 *   「골든 챔스라는 사이트에서 파는 물품을 관장님도매가로 사서 드릴거야」)
 *
 *   앱에서 주문 → 체육관 데스크에서 결제 → 결제한 주문만 발주 → 도착 알림 → 체육관에서 받기.
 *   입구: 전체 메뉴 「153 마켓」(우리 지점 마켓이 켜져 있을 때만) · 검색 · 주문 알림(/market?orders=1 = 내 주문 창).
 *   서버 market_home 이 {on:false} 면(켜지 않은 지점 · 상품이 아직 없음) 준비 중 안내만 보인다.
 *   「어디서 사 오나」 줄(2026-11-18 — 골든챔스에서 체육관 도매가로 사 온다)은 늘 보이고, 누르면 판매 안내 첫 칸으로.
 *   예시 화면 /market?demo=1 — 서버를 부르지 않는다(가격은 지어낸 숫자).
 *   계산 · 글 lib/market153 · 읽고 쓰기 services/marketService.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, RotateCcw, ShoppingBag, Store } from "lucide-react";

import { AppPage, PageHeader } from "@/components/ui/rankingup";
import { OsBackButton, OsEmpty, OsLoading } from "@/components/os/OsParts";
import { CompareBadge, OrderStatusChip, OrderSteps, ProductThumb } from "@/components/market/MarketParts";
import MarketProductSheet from "@/components/market/MarketProductSheet";
import MarketOrdersSheet from "@/components/market/MarketOrdersSheet";
import MarketWishSheet from "@/components/market/MarketWishSheet";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import {
  MARKET_SOURCE,
  categoriesOf,
  compareOf,
  headlineOrder,
  isOpenOrder,
  marketGuide,
  orderMemberLine,
  orderTitle,
  sellerLines,
  won,
  type MarketCategory,
  type MarketHome,
  type MarketProduct,
} from "@/lib/market153";
import { isMarketDemo, useMarketHome } from "@/services/marketService";
import { cn } from "@/lib/utils";

const FLOW = ["앱에서 주문", "데스크 결제", "체육관에서 받기"] as const;

const ProductTile = ({ product, home, onOpen }: { product: MarketProduct; home: MarketHome; onOpen: (p: MarketProduct) => void }) => {
  const compare = compareOf(product, home.today, home.staleDays);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(product)}
        className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-elev-1 transition-transform active:scale-[0.98]"
      >
        <span className="relative block aspect-square w-full overflow-hidden">
          <ProductThumb product={product} />
          {product.soldOut && (
            <span className="absolute inset-0 flex items-center justify-center bg-background/75 text-label font-black text-foreground">품절</span>
          )}
        </span>
        <span className="flex flex-1 flex-col px-3 pb-3 pt-2.5">
          {product.brand && <span className="text-micro font-bold text-muted-foreground">{product.brand}</span>}
          <span className="line-clamp-2 text-label font-bold leading-snug text-foreground">{product.name}</span>
          <span className="mt-auto block pt-1.5 text-heading font-black tabular-nums tracking-tight text-foreground">{won(product.price)}</span>
          <CompareBadge compare={compare} />
        </span>
      </button>
    </li>
  );
};

const MarketPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { role } = useAuth();
  const demo = isMarketDemo();
  const q = useMarketHome();
  const home = q.data;

  const [cat, setCat] = useState<MarketCategory | "all">("all");
  const [picked, setPicked] = useState<MarketProduct | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [wishOpen, setWishOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const guideRef = useRef<HTMLElement>(null);

  // 알림 링크 /market?orders=1 → 내 주문 창 (한 번 열고 주소에서 지운다)
  useEffect(() => {
    if (params.get("orders") !== "1") return;
    setOrdersOpen(true);
    const next = new URLSearchParams(params);
    next.delete("orders");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const cats = useMemo(() => (home ? categoriesOf(home.products) : []), [home]);
  const shown = useMemo(
    () => (home ? (cat === "all" ? home.products : home.products.filter((p) => p.category === cat)) : []),
    [home, cat],
  );
  // 고른 분류의 상품이 없어지면(다시 읽기) 전체로
  useEffect(() => {
    if (cat !== "all" && home && !home.products.some((p) => p.category === cat)) setCat("all");
  }, [cat, home]);

  const headline = home ? headlineOrder(home.orders) : null;
  const openCount = home ? home.orders.filter(isOpenOrder).length : 0;
  // 창이 열려 있는 동안 상품이 다시 읽히면 새 값으로
  const live = picked && home ? (home.products.find((p) => p.id === picked.id) ?? picked) : picked;
  const seller = home ? sellerLines(home.seller) : [];
  const canManage = !!home?.staff && isManagerRole(role);

  const openProduct = (p: MarketProduct) => {
    setPicked(p);
    setProductOpen(true);
  };

  // 「어디서 사 오나」 줄 → 판매 안내를 펼치고 그 칸으로 (첫 칸 = 어디서 사 오나요?)
  const openGuide = () => {
    setGuideOpen(true);
    window.requestAnimationFrame(() => {
      const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      guideRef.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    });
  };

  return (
    <AppPage
      header={
        <PageHeader
          title="153 마켓"
          sticky
          leftAction={<OsBackButton fallback="/home" />}
          rightAction={
            home?.on ? (
              <button
                type="button"
                onClick={() => setOrdersOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-full bg-secondary px-3.5 text-label font-bold text-secondary-foreground active:scale-95"
              >
                내 주문
                {openCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-micro font-black tabular-nums text-primary-foreground">
                    {openCount}
                  </span>
                )}
              </button>
            ) : undefined
          }
        />
      }
    >
      {q.isLoading && <OsLoading rows={4} label="마켓 불러오는 중" />}

      {q.isError && (
        <div className="rounded-2xl bg-card px-5 py-8 text-center shadow-elev-1">
          <p className="text-body font-bold text-foreground">마켓을 불러오지 못했어요</p>
          <p className="mt-1 text-label text-muted-foreground">{q.error instanceof Error ? q.error.message : "잠시 뒤 다시 시도해 주세요"}</p>
          <button
            type="button"
            onClick={() => q.refetch()}
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-4 text-label font-bold text-foreground active:scale-95"
          >
            <RotateCcw className="h-4 w-4" /> 다시 시도
          </button>
        </div>
      )}

      {home && !home.on && (
        <OsEmpty
          icon={<ShoppingBag className="h-7 w-7 text-muted-foreground" />}
          title="153 마켓은 준비 중이에요"
          line="문을 열면 전체 메뉴에서 만날 수 있어요"
        />
      )}

      {home?.on && (
        <div className="space-y-4">
          {demo && (
            <p className="rounded-xl border border-dashed border-border bg-secondary/60 px-3.5 py-2.5 text-label leading-snug text-muted-foreground">
              <b className="font-bold text-foreground">예시 화면</b> · 회원가와 최저가는 지어낸 숫자예요
            </p>
          )}
          {home.preview && (
            <p className="rounded-xl border border-dashed border-border bg-secondary/60 px-3.5 py-2.5 text-label leading-snug text-muted-foreground">
              <b className="font-bold text-foreground">{home.branch ?? "시범 지점"} 미리 보기</b> · 주문은 그 지점 회원만 할 수 있어요
            </p>
          )}

          {headline ? (
            <button
              type="button"
              onClick={() => setOrdersOpen(true)}
              className="block w-full rounded-2xl border border-border bg-card p-4 text-left shadow-elev-1 active:scale-[0.99]"
            >
              <span className="flex items-start gap-2">
                <span className="min-w-0 flex-1 text-body font-bold leading-snug text-foreground">{orderTitle(headline)}</span>
                <OrderStatusChip status={headline.status} />
              </span>
              <span className="mt-3 block">
                <OrderSteps status={headline.status} />
              </span>
              <span className="mt-3 flex items-center gap-2">
                <span className={cn("min-w-0 flex-1 text-label font-bold", headline.status === "arrived" ? "text-primary" : "text-foreground")}>
                  {orderMemberLine(headline)}
                </span>
                {openCount > 1 && <span className="shrink-0 text-label text-muted-foreground">외 {openCount - 1}건</span>}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </span>
            </button>
          ) : (
            <ol className="grid grid-cols-3 gap-1.5 rounded-2xl bg-secondary/60 p-2" aria-label="주문 방법">
              {FLOW.map((label, i) => (
                <li key={label} className="flex flex-col items-center gap-1 rounded-xl bg-card px-1.5 py-2.5 text-center">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-micro font-black text-primary-foreground" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="text-micro font-bold leading-tight text-foreground">{label}</span>
                </li>
              ))}
            </ol>
          )}

          <button
            type="button"
            onClick={openGuide}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-elev-1 active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10" aria-hidden>
              <Store className="h-5 w-5 text-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body font-bold leading-snug text-foreground [text-wrap-style:balance]">{MARKET_SOURCE.line}</span>
              <span className="mt-0.5 block text-label text-muted-foreground">{MARKET_SOURCE.sub}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>

          {cats.length > 1 && (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="분류">
              {[{ key: "all" as const, label: "전체" }, ...cats].map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="tab"
                  aria-selected={cat === c.key}
                  onClick={() => setCat(c.key)}
                  className={cn(
                    "h-10 shrink-0 rounded-full px-4 text-label font-bold transition-colors",
                    cat === c.key ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {shown.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3">
              {shown.map((p) => (
                <ProductTile key={p.id} product={p} home={home} onOpen={openProduct} />
              ))}
            </ul>
          ) : (
            <OsEmpty
              icon={<ShoppingBag className="h-7 w-7 text-muted-foreground" />}
              title="지금은 올라온 상품이 없어요"
              line={canManage ? "주문함 · 상품 관리에서 상품을 켜 주세요" : "찾는 용품을 요청해 주시면 알아볼게요"}
            />
          )}

          <button
            type="button"
            onClick={() => setWishOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-4 py-3.5 text-left active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1 text-body font-bold text-foreground">찾는 용품이 없나요?</span>
            <span className="shrink-0 text-label font-bold text-primary">요청하기</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>

          <section ref={guideRef} className="scroll-mt-20 overflow-hidden rounded-2xl border border-border bg-card">
            <button
              type="button"
              aria-expanded={guideOpen}
              onClick={() => setGuideOpen((v) => !v)}
              className="flex h-14 w-full items-center gap-2 px-4 text-left"
            >
              <span className="min-w-0 flex-1 text-body font-bold text-foreground">판매 안내</span>
              <span className="shrink-0 text-label text-muted-foreground">사 오는 곳 · 결제 · 받기</span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", guideOpen && "rotate-180")} aria-hidden />
            </button>
            {guideOpen && (
              <div className="space-y-3 border-t border-border px-4 py-4">
                <dl className="space-y-3">
                  {marketGuide(home.staleDays).map((g) => (
                    <div key={g.title}>
                      <dt className="text-label font-bold text-foreground">{g.title}</dt>
                      <dd className="mt-0.5 text-label leading-relaxed text-muted-foreground">{g.body}</dd>
                    </div>
                  ))}
                </dl>
                {seller.length > 0 && (
                  <div className="border-t border-border pt-3">
                    <p className="text-label font-bold text-foreground">판매자 정보</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {seller.map((line) => (
                        <li key={line} className="text-label leading-relaxed text-muted-foreground">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          {canManage && (
            <button
              type="button"
              onClick={() => navigate(`/manager?tab=market${demo ? "&demo=1" : ""}`)}
              className="flex h-14 w-full items-center gap-2 rounded-2xl bg-secondary px-4 text-left active:scale-[0.99]"
            >
              <span className="min-w-0 flex-1 text-body font-bold text-secondary-foreground">주문함 · 상품 관리</span>
              <span className="shrink-0 text-label text-muted-foreground">코치진</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          )}
        </div>
      )}

      {home?.on && (
        <>
          <MarketProductSheet
            open={productOpen}
            onOpenChange={setProductOpen}
            product={live}
            home={home}
            onSeeOrders={() => window.setTimeout(() => setOrdersOpen(true), 250)}
          />
          <MarketOrdersSheet open={ordersOpen} onOpenChange={setOrdersOpen} home={home} />
          <MarketWishSheet open={wishOpen} onOpenChange={setWishOpen} preview={home.preview} />
        </>
      )}
    </AppPage>
  );
};

export default MarketPage;
