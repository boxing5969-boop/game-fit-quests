/**
 * 🛍 153 마켓 — 작은 조각들 (상품 그림 · 가격 비교 · 주문 상태 칩 · 진행 줄)
 *   글 · 계산은 lib/market153. 상품 그림이 없으면 분류의 153 입체 아이콘을 얹는다.
 */
import { Check } from "lucide-react";
import { icon3dSrc } from "@/lib/emoji3d/map";
import {
  MEMBER_STEPS,
  ORDER_STATUS_LABEL,
  categoryMeta,
  compareEvidence,
  compareLong,
  compareShortParts,
  orderStepIndex,
  won,
  type MarketOrderStatus,
  type MarketProduct,
  type PriceCompare,
} from "@/lib/market153";
import { cn } from "@/lib/utils";

/** 상품 그림 — 부모가 크기를 정한다(가득 채움) */
export const ProductThumb = ({ product, className }: { product: Pick<MarketProduct, "image" | "category">; className?: string }) =>
  product.image ? (
    <img src={product.image} alt="" className={cn("h-full w-full object-cover", className)} loading="lazy" decoding="async" />
  ) : (
    <span className={cn("flex h-full w-full items-center justify-center bg-secondary/70", className)}>
      <img
        src={icon3dSrc(categoryMeta(product.category).icon)}
        alt=""
        className="h-[54%] w-[54%] object-contain"
        loading="lazy"
        decoding="async"
      />
    </span>
  );

const STATUS_TONE: Record<MarketOrderStatus, string> = {
  applied: "bg-foreground text-background",
  paid: "bg-secondary text-secondary-foreground",
  ordered: "bg-secondary text-secondary-foreground",
  arrived: "bg-primary/15 text-primary",
  delivered: "bg-secondary text-muted-foreground",
  canceled: "bg-secondary text-muted-foreground",
};

export const OrderStatusChip = ({ status, className }: { status: MarketOrderStatus; className?: string }) => (
  <span className={cn("inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-micro font-bold", STATUS_TONE[status], className)}>
    {ORDER_STATUS_LABEL[status]}
  </span>
);

/** 회원 진행 줄 — 주문 · 결제 · 도착 · 받음 */
export const OrderSteps = ({ status }: { status: MarketOrderStatus }) => {
  const at = orderStepIndex(status);
  if (at < 0) return null;
  return (
    <ol className="flex items-center" aria-label={`진행 ${MEMBER_STEPS[at]}`}>
      {MEMBER_STEPS.map((label, i) => (
        <li key={label} className={cn("flex items-center", i > 0 && "flex-1")}>
          {i > 0 && <span className={cn("mx-1.5 h-0.5 flex-1 rounded-full", i <= at ? "bg-primary" : "bg-border")} aria-hidden />}
          <span className="flex items-center gap-1">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-micro font-black",
                i <= at ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
              aria-hidden
            >
              {i < at ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn("text-micro font-bold", i <= at ? "text-foreground" : "text-muted-foreground")}>{label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
};

/** 타일용 한 줄 — 최저가보다 10,000원 저렴 */
export const CompareBadge = ({ compare, className }: { compare: PriceCompare | null; className?: string }) => {
  if (!compare) return null;
  // 좁은 칸에서는 「최저가보다 / 4,500원 저렴」으로 꺾인다 — 「저렴」만 혼자 내려가지 않게 두 덩어리로.
  const [who, saving] = compareShortParts(compare);
  return (
    <span className={cn("flex flex-wrap gap-x-1 text-micro font-bold leading-tight text-primary", className)}>
      <span className="whitespace-nowrap">{who}</span>
      <span className="whitespace-nowrap tabular-nums">{saving}</span>
    </span>
  );
};

/** 상품 창 가격 칸 — 회원가 + 비교 근거 */
export const PriceBlock = ({ price, compare }: { price: number; compare: PriceCompare | null }) => (
  <div className="rounded-2xl bg-secondary/60 px-4 py-3.5">
    <p className="text-label font-bold text-muted-foreground">회원가</p>
    <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-title font-black tabular-nums tracking-tight text-foreground">{won(price)}</span>
      {compare && compare.percent > 0 && (
        <span className="text-body font-black tabular-nums text-primary">{compare.percent}% 저렴</span>
      )}
    </p>
    {compare && (
      <p className="mt-2 border-t border-border/70 pt-2 text-label text-muted-foreground">
        <span className="font-bold tabular-nums text-foreground">{compareLong(compare)}</span>
        <span className="mt-0.5 block text-micro">{compareEvidence(compare)}</span>
      </p>
    )}
  </div>
);
