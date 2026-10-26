/**
 * 🪙 결제 확인 창의 '153 마일리지 쓰기' 칸 (2026-10-21 대표님: "수강권 탭에서 결제하기 눌러도 마일리지 입력 탭이 없는데")
 *   · 항상 보인다 — 못 쓰면 이유(1,000점 미만 · 1만 원 미만 상품 · 지도진 계정)를 보여 준다
 *   · 점수를 직접 넣거나 −/+ 1,000 · '최대'로 고른다. 쓰는 도중엔 그대로 두고, 칸을 벗어나면 1,000 단위로 맞춘다
 *   · 실제로 쓸 점수 = clampMileageUse(value, 최대) — 부모가 결제할 때도 같은 함수로 한 번 더 맞춘다
 *   규칙 · 계산은 lib/mileagePay (서버 mileage_max_use 와 같은 식). 서버가 다시 검사하고, 결제가 끝나야 빠진다.
 */
import { Coins, Minus, Plus } from "lucide-react";
import {
  MILEAGE_BLOCK_TEXT,
  MILEAGE_UNIT,
  clampMileageUse,
  maxMileageUse,
  mileageBlockReason,
  parseMileageInput,
} from "@/lib/mileagePay";
import { cn } from "@/lib/utils";

interface Props {
  /** 마일리지 10% 기준 금액(원) — 상품 하나면 그 상품 금액, 장바구니면 수강권 금액 (2026-10-27) */
  price: number;
  /** 장바구니 합계(원) — 있으면 '합계 − 점수 = 결제 금액' 줄에 쓴다. 없으면 price */
  payTotal?: number;
  /** 10% 기준 이름 — 기본 '결제 금액', 장바구니(수강권 있음)는 '수강권 금액' */
  baseLabel?: string;
  /** 내 마일리지 잔액 */
  balance: number;
  loading?: boolean;
  failed?: boolean;
  /** 지도진·관리자 계정 — 마일리지가 쌓이지 않는다 */
  isStaff?: boolean;
  /** 입력한 점수 (쓰는 도중엔 1,000 단위가 아닐 수 있다) */
  value: number;
  onChange: (pts: number) => void;
  className?: string;
}

const n = (v: number) => v.toLocaleString("ko-KR");

const MileagePayBox = ({ price, payTotal, baseLabel = "결제 금액", balance, loading = false, failed = false, isStaff = false, value, onChange, className }: Props) => {
  const max = maxMileageUse(balance, price);
  const total = payTotal ?? price;
  const used = clampMileageUse(value, max);
  const block = mileageBlockReason({ balance, price, isStaff });

  return (
    <section
      className={cn("rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-left", className)}
      aria-label="153 마일리지 쓰기"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-black text-foreground">
          <Coins className="h-4 w-4 text-amber-600" aria-hidden />
          153 마일리지 쓰기
        </p>
        {!loading && !failed && (
          <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-muted-foreground">보유 {n(balance)}점</span>
        )}
      </div>

      {loading ? (
        <p className="mt-1.5 text-[12.5px] text-muted-foreground">마일리지를 확인하고 있어요…</p>
      ) : failed ? (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
          마일리지를 불러오지 못했어요. 결제는 그대로 할 수 있고, 마일리지는 데스크에서 차감해 드려요.
        </p>
      ) : block ? (
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{MILEAGE_BLOCK_TEXT[block]}</p>
      ) : (
        <>
          <div className="mt-2.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange(Math.max(0, used - MILEAGE_UNIT))}
              disabled={used <= 0}
              aria-label="1,000점 빼기"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background text-foreground ring-1 ring-border transition-transform active:scale-95 disabled:opacity-40"
            >
              <Minus className="h-4 w-4" />
            </button>
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">쓸 마일리지 점수</span>
              <input
                type="text"
                inputMode="numeric"
                value={value > 0 ? n(value) : ""}
                onChange={(e) => onChange(parseMileageInput(e.target.value, max))}
                onBlur={() => onChange(used)}
                placeholder="0"
                className="h-11 w-full rounded-xl border border-border bg-background pl-3 pr-8 text-right text-base font-black tabular-nums text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">점</span>
            </label>
            <button
              type="button"
              onClick={() => onChange(Math.min(max, used + MILEAGE_UNIT))}
              disabled={used >= max}
              aria-label="1,000점 더하기"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background text-foreground ring-1 ring-border transition-transform active:scale-95 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onChange(used >= max ? 0 : max)}
              className="h-11 shrink-0 rounded-xl bg-foreground px-3 text-[12.5px] font-bold text-background transition-transform active:scale-95"
            >
              {used >= max ? "안 쓰기" : "최대"}
            </button>
          </div>

          {used > 0 ? (
            <p className="mt-2 text-[13px] text-foreground">
              {n(total)}원 − {n(used)}점 = <b className="tabular-nums">{n(total - used)}원</b> 결제
            </p>
          ) : null}
          {value > 0 && value !== used ? (
            <p className="mt-1 text-[12px] font-bold text-amber-700">1,000점 단위로 맞춰서 {n(used)}점을 써요</p>
          ) : null}
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
            이번 결제는 최대 {n(max)}점 (1점 = 1원 · {baseLabel}의 10%까지 · 1,000점 단위) · 결제가 끝나야 빠지고, 취소하면 돌아와요
          </p>
        </>
      )}
    </section>
  );
};

export default MileagePayBox;
